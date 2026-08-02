use std::io::{Cursor, Read, Seek, Write};

use quick_xml::{Reader, events::Event};
use serde::Deserialize;
use zip::{CompressionMethod, ZipArchive, ZipWriter, write::SimpleFileOptions};

pub(crate) const DOCX_MAX_ARCHIVE_ENTRIES: usize = 256;
pub(crate) const DOCX_MAX_DOCUMENT_XML_BYTES: usize = 10 * 1024 * 1024;
pub(crate) const DOCX_MAX_TEXT_BYTES: usize = 5 * 1024 * 1024;
pub(crate) const DOCX_MAX_EXPORT_BYTES: usize = 20 * 1024 * 1024;
pub(crate) const DOCX_MAX_VOLUMES: usize = 200;
pub(crate) const DOCX_MAX_CHAPTERS: usize = 10_000;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DocxExportDocument {
    pub(crate) title: String,
    pub(crate) volumes: Vec<DocxExportVolume>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DocxExportVolume {
    pub(crate) title: String,
    pub(crate) chapters: Vec<DocxExportChapter>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DocxExportChapter {
    pub(crate) title: String,
    pub(crate) content: String,
}

fn local_name(name: &[u8]) -> &[u8] {
    name.rsplit(|byte| *byte == b':').next().unwrap_or(name)
}

fn push_bounded(target: &mut String, value: &str) -> Result<(), String> {
    if target.len().saturating_add(value.len()) > DOCX_MAX_TEXT_BYTES {
        return Err("importSourceTooLarge".to_owned());
    }
    target.push_str(value);
    Ok(())
}

pub(crate) fn extract_document_text<R: Read + Seek>(reader: R) -> Result<String, String> {
    let mut archive = ZipArchive::new(reader).map_err(|_| "importDocxInvalid".to_owned())?;
    if archive.len() == 0 || archive.len() > DOCX_MAX_ARCHIVE_ENTRIES {
        return Err("importDocxTooManyEntries".to_owned());
    }
    for index in 0..archive.len() {
        let entry = archive
            .by_index_raw(index)
            .map_err(|_| "importDocxInvalid".to_owned())?;
        if entry.encrypted() {
            return Err("importDocxEncrypted".to_owned());
        }
    }
    let document = archive
        .by_name("word/document.xml")
        .map_err(|_| "importDocxMainDocumentMissing".to_owned())?;
    if usize::try_from(document.size()).unwrap_or(usize::MAX) > DOCX_MAX_DOCUMENT_XML_BYTES {
        return Err("importDocxXmlTooLarge".to_owned());
    }
    let mut xml = Vec::with_capacity(
        usize::try_from(document.size())
            .unwrap_or(DOCX_MAX_DOCUMENT_XML_BYTES)
            .min(DOCX_MAX_DOCUMENT_XML_BYTES),
    );
    document
        .take((DOCX_MAX_DOCUMENT_XML_BYTES + 1) as u64)
        .read_to_end(&mut xml)
        .map_err(|_| "importDocxInvalid".to_owned())?;
    if xml.len() > DOCX_MAX_DOCUMENT_XML_BYTES {
        return Err("importDocxXmlTooLarge".to_owned());
    }

    let mut reader = Reader::from_reader(xml.as_slice());
    reader.config_mut().check_end_names = true;
    reader.config_mut().trim_text(false);
    let mut paragraphs = Vec::<String>::new();
    let mut paragraph: Option<String> = None;
    let mut in_body = false;
    let mut in_text = false;

    loop {
        match reader.read_event() {
            Ok(Event::Start(event)) => match local_name(event.name().as_ref()) {
                b"body" => in_body = true,
                b"p" if in_body => paragraph = Some(String::new()),
                b"t" if paragraph.is_some() => in_text = true,
                b"tab" if paragraph.is_some() => {
                    push_bounded(paragraph.as_mut().expect("paragraph present"), "\t")?;
                }
                b"br" | b"cr" if paragraph.is_some() => {
                    push_bounded(paragraph.as_mut().expect("paragraph present"), "\n")?;
                }
                _ => {}
            },
            Ok(Event::Empty(event)) => match local_name(event.name().as_ref()) {
                b"tab" if paragraph.is_some() => {
                    push_bounded(paragraph.as_mut().expect("paragraph present"), "\t")?;
                }
                b"br" | b"cr" if paragraph.is_some() => {
                    push_bounded(paragraph.as_mut().expect("paragraph present"), "\n")?;
                }
                _ => {}
            },
            Ok(Event::Text(event)) if in_text => {
                let value = event
                    .decode()
                    .map_err(|_| "importDocxInvalidXml".to_owned())?;
                push_bounded(paragraph.as_mut().expect("text requires paragraph"), &value)?;
            }
            Ok(Event::GeneralRef(event)) if in_text => {
                let value = if let Some(character) = event
                    .resolve_char_ref()
                    .map_err(|_| "importDocxInvalidXml".to_owned())?
                {
                    character.to_string()
                } else {
                    match event
                        .decode()
                        .map_err(|_| "importDocxInvalidXml".to_owned())?
                        .as_ref()
                    {
                        "amp" => "&".to_owned(),
                        "lt" => "<".to_owned(),
                        "gt" => ">".to_owned(),
                        "apos" => "'".to_owned(),
                        "quot" => "\"".to_owned(),
                        _ => return Err("importDocxInvalidXml".to_owned()),
                    }
                };
                push_bounded(
                    paragraph.as_mut().expect("reference requires paragraph"),
                    &value,
                )?;
            }
            Ok(Event::CData(event)) if in_text => {
                let value = event
                    .decode()
                    .map_err(|_| "importDocxInvalidXml".to_owned())?;
                push_bounded(paragraph.as_mut().expect("text requires paragraph"), &value)?;
            }
            Ok(Event::End(event)) => match local_name(event.name().as_ref()) {
                b"t" => in_text = false,
                b"p" if paragraph.is_some() => {
                    paragraphs.push(paragraph.take().expect("paragraph present"));
                }
                b"body" => in_body = false,
                _ => {}
            },
            Ok(Event::DocType(_)) => return Err("importDocxInvalidXml".to_owned()),
            Ok(Event::Eof) => break,
            Ok(_) => {}
            Err(_) => return Err("importDocxInvalidXml".to_owned()),
        }
    }
    while paragraphs.last().is_some_and(String::is_empty) {
        paragraphs.pop();
    }
    let content = paragraphs.join("\n\n");
    if content.trim().is_empty() {
        return Err("importSourceEmpty".to_owned());
    }
    if content.len() > DOCX_MAX_TEXT_BYTES {
        return Err("importSourceTooLarge".to_owned());
    }
    Ok(content)
}

fn valid_xml_character(character: char) -> bool {
    matches!(character, '\u{9}' | '\u{a}' | '\u{d}')
        || ('\u{20}'..='\u{d7ff}').contains(&character)
        || ('\u{e000}'..='\u{fffd}').contains(&character)
        || ('\u{10000}'..='\u{10ffff}').contains(&character)
}

fn escape_xml(value: &str) -> String {
    let mut escaped = String::with_capacity(value.len());
    for character in value.chars() {
        match character {
            '&' => escaped.push_str("&amp;"),
            '<' => escaped.push_str("&lt;"),
            '>' => escaped.push_str("&gt;"),
            '"' => escaped.push_str("&quot;"),
            '\'' => escaped.push_str("&apos;"),
            _ if valid_xml_character(character) => escaped.push(character),
            _ => escaped.push('\u{fffd}'),
        }
    }
    escaped
}

fn paragraph_xml(text: &str, style: Option<&str>) -> String {
    let style_xml = style
        .map(|style| format!(r#"<w:pPr><w:pStyle w:val="{style}"/></w:pPr>"#))
        .unwrap_or_default();
    if text.is_empty() {
        return format!("<w:p>{style_xml}</w:p>");
    }
    format!(
        r#"<w:p>{style_xml}<w:r><w:t xml:space="preserve">{}</w:t></w:r></w:p>"#,
        escape_xml(text)
    )
}

fn validate_document(document: &DocxExportDocument) -> Result<(), String> {
    let title = document.title.trim();
    if title.is_empty() || title.chars().count() > 200 || title.contains(['\r', '\n']) {
        return Err("docxExportTitleInvalid".to_owned());
    }
    if document.volumes.is_empty() || document.volumes.len() > DOCX_MAX_VOLUMES {
        return Err("docxExportStructureInvalid".to_owned());
    }
    let mut chapter_count = 0usize;
    let mut content_bytes = 0usize;
    for volume in &document.volumes {
        if volume.title.trim().is_empty()
            || volume.title.chars().count() > 200
            || volume.title.contains(['\r', '\n'])
        {
            return Err("docxExportStructureInvalid".to_owned());
        }
        chapter_count = chapter_count.saturating_add(volume.chapters.len());
        for chapter in &volume.chapters {
            if chapter.title.trim().is_empty()
                || chapter.title.chars().count() > 200
                || chapter.title.contains(['\r', '\n'])
            {
                return Err("docxExportStructureInvalid".to_owned());
            }
            content_bytes = content_bytes.saturating_add(chapter.content.len());
        }
    }
    if chapter_count == 0 || chapter_count > DOCX_MAX_CHAPTERS {
        return Err("docxExportStructureInvalid".to_owned());
    }
    if content_bytes > DOCX_MAX_EXPORT_BYTES {
        return Err("docxExportTooLarge".to_owned());
    }
    Ok(())
}

fn document_xml(document: &DocxExportDocument) -> String {
    let mut body = String::new();
    body.push_str(&paragraph_xml(document.title.trim(), Some("Title")));
    for volume in &document.volumes {
        body.push_str(&paragraph_xml(volume.title.trim(), Some("Heading1")));
        for chapter in &volume.chapters {
            body.push_str(&paragraph_xml(chapter.title.trim(), Some("Heading2")));
            for line in chapter
                .content
                .replace("\r\n", "\n")
                .replace('\r', "\n")
                .split('\n')
            {
                body.push_str(&paragraph_xml(line, None));
            }
        }
    }
    format!(
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>{body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>"#
    )
}

const CONTENT_TYPES_XML: &str = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>"#;
const ROOT_RELS_XML: &str = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>"#;
const DOCUMENT_RELS_XML: &str = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>"#;
const STYLES_XML: &str = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="宋体" w:cs="Calibri"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="360" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:rPr><w:b/><w:sz w:val="40"/><w:szCs w:val="40"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:outlineLvl w:val="0"/><w:rPr><w:b/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:outlineLvl w:val="1"/><w:rPr><w:b/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:style></w:styles>"#;
const APP_XML: &str = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Writing Buddy</Application><AppVersion>1.2</AppVersion></Properties>"#;

pub(crate) fn build_document_bytes(
    document: &DocxExportDocument,
    created_at: &str,
) -> Result<Vec<u8>, String> {
    validate_document(document)?;
    let core_xml = format!(
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>{}</dc:title><dc:creator>Writing Buddy</dc:creator><cp:lastModifiedBy>Writing Buddy</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">{}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">{}</dcterms:modified></cp:coreProperties>"#,
        escape_xml(document.title.trim()),
        escape_xml(created_at),
        escape_xml(created_at)
    );
    let files = [
        ("[Content_Types].xml", CONTENT_TYPES_XML.to_owned()),
        ("_rels/.rels", ROOT_RELS_XML.to_owned()),
        ("word/document.xml", document_xml(document)),
        ("word/styles.xml", STYLES_XML.to_owned()),
        ("word/_rels/document.xml.rels", DOCUMENT_RELS_XML.to_owned()),
        ("docProps/core.xml", core_xml),
        ("docProps/app.xml", APP_XML.to_owned()),
    ];
    let cursor = Cursor::new(Vec::new());
    let mut writer = ZipWriter::new(cursor);
    let options = SimpleFileOptions::default()
        .compression_method(CompressionMethod::Deflated)
        .unix_permissions(0o644);
    for (path, content) in files {
        writer
            .start_file(path, options)
            .map_err(|_| "docxExportPackageFailed".to_owned())?;
        writer
            .write_all(content.as_bytes())
            .map_err(|_| "docxExportPackageFailed".to_owned())?;
    }
    writer
        .finish()
        .map(|cursor| cursor.into_inner())
        .map_err(|_| "docxExportPackageFailed".to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture() -> DocxExportDocument {
        DocxExportDocument {
            title: "零点 & 回声".to_owned(),
            volumes: vec![DocxExportVolume {
                title: "第一卷".to_owned(),
                chapters: vec![DocxExportChapter {
                    title: "第一章 <迟到>".to_owned(),
                    content: "雨落在玻璃顶上。\n\n顾言按下‘确认’。".to_owned(),
                }],
            }],
        }
    }

    #[test]
    fn builds_a_structured_package_and_round_trips_visible_text() {
        let bytes = build_document_bytes(&fixture(), "2026-08-01T00:00:00Z").expect("build docx");
        let mut archive = ZipArchive::new(Cursor::new(bytes.clone())).expect("open package");
        for path in [
            "[Content_Types].xml",
            "_rels/.rels",
            "word/document.xml",
            "word/styles.xml",
            "word/_rels/document.xml.rels",
        ] {
            assert!(archive.by_name(path).is_ok(), "missing {path}");
        }
        let mut document_xml = String::new();
        archive
            .by_name("word/document.xml")
            .expect("document xml")
            .read_to_string(&mut document_xml)
            .expect("read xml");
        assert!(document_xml.contains("零点 &amp; 回声"));
        assert!(document_xml.contains("第一章 &lt;迟到&gt;"));
        drop(archive);

        let text = extract_document_text(Cursor::new(bytes)).expect("extract text");
        assert_eq!(
            text,
            "零点 & 回声\n\n第一卷\n\n第一章 <迟到>\n\n雨落在玻璃顶上。\n\n\n\n顾言按下‘确认’。"
        );
    }

    #[test]
    fn rejects_oversized_or_empty_export_content() {
        let mut document = fixture();
        document.volumes[0].chapters[0].content = "x".repeat(DOCX_MAX_EXPORT_BYTES + 1);
        assert_eq!(
            build_document_bytes(&document, "2026-08-01T00:00:00Z").expect_err("reject oversized"),
            "docxExportTooLarge"
        );

        let mut empty = fixture();
        empty.volumes.clear();
        assert_eq!(
            build_document_bytes(&empty, "2026-08-01T00:00:00Z")
                .expect_err("reject empty structure"),
            "docxExportStructureInvalid"
        );
    }
}
