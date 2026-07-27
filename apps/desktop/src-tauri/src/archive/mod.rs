use std::{
    collections::{BTreeMap, HashSet},
    fs,
    io::{Cursor, Read},
    path::{Path, PathBuf},
};

use chrono::Utc;
use serde::{Deserialize, Serialize};
use walkdir::WalkDir;

use crate::{filesystem, migration::WritingProject};

const MAGIC: &[u8; 8] = b"WBBAKUP\0";
const MAX_ARCHIVE_BYTES: usize = 2 * 1024 * 1024 * 1024;
const MAX_ENTRY_COUNT: usize = 100_000;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupEntry {
    pub relative_path: String,
    pub byte_length: usize,
    pub content_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupMetadata {
    pub schema_version: u64,
    pub project_id: String,
    pub created_at: String,
    pub reason: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    pub app_version: String,
    pub entries: Vec<BackupEntry>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupResult {
    pub path: String,
    pub hash: String,
    pub byte_length: usize,
    pub entry_count: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupInspection {
    pub valid: bool,
    pub format_version: Option<u64>,
    pub project_id: Option<String>,
    pub created_at: Option<String>,
    pub entry_count: usize,
    pub issues: Vec<String>,
}

fn safe_archive_path(value: &str) -> bool {
    !value.is_empty()
        && !value.contains('\0')
        && !value.contains('\\')
        && !value.starts_with('/')
        && !value.contains(':')
        && !value
            .split('/')
            .any(|segment| segment.is_empty() || segment == "." || segment == "..")
}

fn excluded_backup_path(relative: &str) -> bool {
    let lower = relative.to_ascii_lowercase();
    lower.starts_with(".git/")
        || lower.starts_with("node_modules/")
        || lower.starts_with(".writing-buddy/history/")
        || lower.starts_with(".writing-buddy/runtime/")
        || lower.starts_with(".writing-buddy/cache/")
        || lower.starts_with(".writing-buddy/ai/tmp/")
        || lower.starts_with(".writing-buddy/ai/cache/")
        || lower.ends_with(".wbbackup")
}

fn collect(root: &Path) -> Result<BTreeMap<String, Vec<u8>>, String> {
    let mut files = BTreeMap::new();
    for entry in WalkDir::new(root).follow_links(false).into_iter() {
        let entry = entry.map_err(|_| "backupScanFailed".to_owned())?;
        if entry.file_type().is_symlink() {
            return Err("backupSymlinkRejected".to_owned());
        }
        if !entry.file_type().is_file() {
            continue;
        }
        let relative = entry
            .path()
            .strip_prefix(root)
            .map_err(|_| "unsafePath".to_owned())?
            .components()
            .map(|component| component.as_os_str().to_string_lossy())
            .collect::<Vec<_>>()
            .join("/");
        if excluded_backup_path(&relative) {
            continue;
        }
        if !safe_archive_path(&relative) {
            return Err("unsafePath".to_owned());
        }
        let bytes = fs::read(entry.path()).map_err(|_| "backupReadFailed".to_owned())?;
        files.insert(relative, bytes);
    }
    Ok(files)
}

fn push_u32(buffer: &mut Vec<u8>, value: usize) -> Result<(), String> {
    let value = u32::try_from(value).map_err(|_| "backupTooLarge".to_owned())?;
    buffer.extend_from_slice(&value.to_be_bytes());
    Ok(())
}

fn push_u64(buffer: &mut Vec<u8>, value: usize) -> Result<(), String> {
    let value = u64::try_from(value).map_err(|_| "backupTooLarge".to_owned())?;
    buffer.extend_from_slice(&value.to_be_bytes());
    Ok(())
}

pub fn create(
    project_root: &str,
    destination: Option<&str>,
    reason: &str,
    label: Option<&str>,
) -> Result<BackupResult, String> {
    let root = filesystem::canonical_project_root(project_root)?;
    let manifest_path = root.join(".writing-buddy").join("project.json");
    let project_bytes = fs::read(&manifest_path).map_err(|_| "manifestReadFailed".to_owned())?;
    let project: WritingProject =
        serde_json::from_slice(&project_bytes).map_err(|_| "invalidManifest".to_owned())?;
    let files = collect(&root)?;
    let created_at = Utc::now().to_rfc3339();
    let entries = files
        .iter()
        .map(|(relative_path, bytes)| BackupEntry {
            relative_path: relative_path.clone(),
            byte_length: bytes.len(),
            content_hash: filesystem::sha256(bytes),
        })
        .collect::<Vec<_>>();
    let metadata = BackupMetadata {
        schema_version: 1,
        project_id: project.project_id.clone(),
        created_at: created_at.clone(),
        reason: reason.to_owned(),
        label: label.map(ToOwned::to_owned),
        app_version: env!("CARGO_PKG_VERSION").to_owned(),
        entries,
    };
    let metadata_bytes =
        serde_json::to_vec(&metadata).map_err(|_| "backupSerializeFailed".to_owned())?;
    let mut archive = Vec::new();
    archive.extend_from_slice(MAGIC);
    push_u32(&mut archive, metadata_bytes.len())?;
    archive.extend_from_slice(&metadata_bytes);
    let metadata_hash = filesystem::sha256(&metadata_bytes);
    archive.extend_from_slice(&hex_to_bytes(&metadata_hash)?);
    for entry in &metadata.entries {
        let path_bytes = entry.relative_path.as_bytes();
        push_u32(&mut archive, path_bytes.len())?;
        archive.extend_from_slice(path_bytes);
        push_u64(&mut archive, entry.byte_length)?;
        archive.extend_from_slice(&hex_to_bytes(&entry.content_hash)?);
        archive.extend_from_slice(
            files
                .get(&entry.relative_path)
                .ok_or_else(|| "backupEntryMissing".to_owned())?,
        );
    }
    let default_directory = root.parent().unwrap_or(&root).join("Writing Buddy Backups");
    fs::create_dir_all(&default_directory).map_err(|_| "backupDirectoryFailed".to_owned())?;
    let safe_time = created_at.replace([':', '.'], "-");
    let target = destination.map(PathBuf::from).unwrap_or_else(|| {
        default_directory.join(format!("{}-{safe_time}.wbbackup", project.project_id))
    });
    filesystem::write_bytes_atomic(&target, &archive)?;
    Ok(BackupResult {
        path: target.to_string_lossy().into_owned(),
        hash: filesystem::sha256(&archive),
        byte_length: archive.len(),
        entry_count: metadata.entries.len(),
    })
}

fn hex_to_bytes(value: &str) -> Result<[u8; 32], String> {
    if value.len() != 64 || !value.chars().all(|character| character.is_ascii_hexdigit()) {
        return Err("invalidHash".to_owned());
    }
    let mut result = [0_u8; 32];
    for (index, slot) in result.iter_mut().enumerate() {
        *slot = u8::from_str_radix(&value[index * 2..index * 2 + 2], 16)
            .map_err(|_| "invalidHash".to_owned())?;
    }
    Ok(result)
}

fn read_u32(cursor: &mut Cursor<&[u8]>) -> Result<usize, String> {
    let mut bytes = [0_u8; 4];
    cursor
        .read_exact(&mut bytes)
        .map_err(|_| "backupTruncated".to_owned())?;
    Ok(u32::from_be_bytes(bytes) as usize)
}

fn read_u64(cursor: &mut Cursor<&[u8]>) -> Result<usize, String> {
    let mut bytes = [0_u8; 8];
    cursor
        .read_exact(&mut bytes)
        .map_err(|_| "backupTruncated".to_owned())?;
    usize::try_from(u64::from_be_bytes(bytes)).map_err(|_| "backupTooLarge".to_owned())
}

fn decode(bytes: &[u8]) -> Result<(BackupMetadata, BTreeMap<String, Vec<u8>>), String> {
    if bytes.len() > MAX_ARCHIVE_BYTES {
        return Err("archiveBombRejected".to_owned());
    }
    let mut cursor = Cursor::new(bytes);
    let mut magic = [0_u8; 8];
    cursor
        .read_exact(&mut magic)
        .map_err(|_| "backupTruncated".to_owned())?;
    if &magic != MAGIC {
        return Err("badMagic".to_owned());
    }
    let metadata_length = read_u32(&mut cursor)?;
    if metadata_length > 16 * 1024 * 1024 {
        return Err("metadataTooLarge".to_owned());
    }
    let mut metadata_bytes = vec![0_u8; metadata_length];
    cursor
        .read_exact(&mut metadata_bytes)
        .map_err(|_| "backupTruncated".to_owned())?;
    let mut metadata_hash = [0_u8; 32];
    cursor
        .read_exact(&mut metadata_hash)
        .map_err(|_| "backupTruncated".to_owned())?;
    if metadata_hash != hex_to_bytes(&filesystem::sha256(&metadata_bytes))? {
        return Err("metadataChecksumMismatch".to_owned());
    }
    let metadata: BackupMetadata =
        serde_json::from_slice(&metadata_bytes).map_err(|_| "invalidMetadata".to_owned())?;
    if metadata.schema_version != 1 || metadata.entries.len() > MAX_ENTRY_COUNT {
        return Err("unsupportedVersion".to_owned());
    }
    let mut seen = HashSet::new();
    let mut entries = BTreeMap::new();
    for expected in &metadata.entries {
        if !safe_archive_path(&expected.relative_path)
            || !seen.insert(expected.relative_path.clone())
        {
            return Err("unsafeOrDuplicatePath".to_owned());
        }
        let path_length = read_u32(&mut cursor)?;
        if path_length > 32 * 1024 {
            return Err("pathTooLong".to_owned());
        }
        let mut path_bytes = vec![0_u8; path_length];
        cursor
            .read_exact(&mut path_bytes)
            .map_err(|_| "backupTruncated".to_owned())?;
        let path = String::from_utf8(path_bytes).map_err(|_| "invalidPathEncoding".to_owned())?;
        if path != expected.relative_path {
            return Err("entryPathMismatch".to_owned());
        }
        let length = read_u64(&mut cursor)?;
        if length != expected.byte_length {
            return Err("entryLengthMismatch".to_owned());
        }
        let mut hash = [0_u8; 32];
        cursor
            .read_exact(&mut hash)
            .map_err(|_| "backupTruncated".to_owned())?;
        if hash != hex_to_bytes(&expected.content_hash)? {
            return Err("entryHashMismatch".to_owned());
        }
        let mut payload = vec![0_u8; length];
        cursor
            .read_exact(&mut payload)
            .map_err(|_| "backupTruncated".to_owned())?;
        if filesystem::sha256(&payload) != expected.content_hash {
            return Err("entryChecksumMismatch".to_owned());
        }
        entries.insert(path, payload);
    }
    if cursor.position() as usize != bytes.len() {
        return Err("unexpectedExtraBytes".to_owned());
    }
    Ok((metadata, entries))
}

pub fn inspect(path: &str) -> BackupInspection {
    let bytes = match fs::File::open(path)
        .map_err(|_| "backupReadFailed".to_owned())
        .and_then(|file| filesystem::read_all(file, MAX_ARCHIVE_BYTES as u64))
    {
        Ok(value) => value,
        Err(_) => {
            return BackupInspection {
                valid: false,
                format_version: None,
                project_id: None,
                created_at: None,
                entry_count: 0,
                issues: vec!["backupReadFailed".to_owned()],
            };
        }
    };
    match decode(&bytes) {
        Ok((metadata, entries)) => BackupInspection {
            valid: true,
            format_version: Some(metadata.schema_version),
            project_id: Some(metadata.project_id),
            created_at: Some(metadata.created_at),
            entry_count: entries.len(),
            issues: Vec::new(),
        },
        Err(issue) => BackupInspection {
            valid: false,
            format_version: None,
            project_id: None,
            created_at: None,
            entry_count: 0,
            issues: vec![issue],
        },
    }
}

pub fn restore(path: &str, destination: &str, overwrite: bool) -> Result<usize, String> {
    let file = fs::File::open(path).map_err(|_| "backupReadFailed".to_owned())?;
    let bytes = filesystem::read_all(file, MAX_ARCHIVE_BYTES as u64)?;
    let (_, entries) = decode(&bytes)?;
    let destination =
        fs::canonicalize(destination).map_err(|_| "restoreDestinationMissing".to_owned())?;
    for relative in [
        ".writing-buddy/cache",
        ".writing-buddy/ai/tmp",
        ".writing-buddy/ai/cache",
    ] {
        let derived = destination.join(relative);
        if derived.exists() {
            fs::remove_dir_all(derived).map_err(|_| "restoreCacheCleanupFailed".to_owned())?;
        }
    }
    for (relative, payload) in &entries {
        let relative_path = filesystem::safe_relative_path(relative)?;
        let target = destination.join(relative_path);
        let parent = target.parent().ok_or_else(|| "unsafePath".to_owned())?;
        fs::create_dir_all(parent).map_err(|_| "restoreWriteFailed".to_owned())?;
        let parent = fs::canonicalize(parent).map_err(|_| "restoreWriteFailed".to_owned())?;
        if !parent.starts_with(&destination) || (!overwrite && target.exists()) {
            return Err("restoreBlocked".to_owned());
        }
        filesystem::write_bytes_atomic(&target, payload)?;
    }
    Ok(entries.len())
}

#[cfg(test)]
mod tests {
    use std::{
        collections::{BTreeMap, HashSet},
        fs,
        path::Path,
        time::{SystemTime, UNIX_EPOCH},
    };

    use serde_json::Value;
    use walkdir::WalkDir;

    use super::{collect, create, decode, inspect, restore};

    fn temp_directory(label: &str) -> std::path::PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        std::env::temp_dir().join(format!(
            "writing-buddy-{label}-{}-{nonce}",
            std::process::id()
        ))
    }

    fn copy_directory(source: &Path, destination: &Path) {
        fs::create_dir_all(destination).expect("create copy destination");
        for entry in WalkDir::new(source).follow_links(false) {
            let entry = entry.expect("scan source copy");
            let relative = entry
                .path()
                .strip_prefix(source)
                .expect("relative copy path");
            let target = destination.join(relative);
            if entry.file_type().is_dir() {
                fs::create_dir_all(&target).expect("create copied directory");
            } else if entry.file_type().is_file() {
                fs::copy(entry.path(), target).expect("copy project file");
            }
        }
    }

    fn collect_ids(value: &Value, ids: &mut HashSet<String>) {
        match value {
            Value::Array(values) => {
                for value in values {
                    collect_ids(value, ids);
                }
            }
            Value::Object(object) => {
                if let Some(id) = object.get("id").and_then(Value::as_str) {
                    ids.insert(id.to_owned());
                }
                for value in object.values() {
                    collect_ids(value, ids);
                }
            }
            _ => {}
        }
    }

    fn collect_id_references(value: &Value, key: Option<&str>, references: &mut Vec<String>) {
        match value {
            Value::Array(values) => {
                for value in values {
                    collect_id_references(value, key, references);
                }
            }
            Value::Object(object) => {
                for (key, value) in object {
                    collect_id_references(value, Some(key), references);
                }
            }
            Value::String(value)
                if key.is_some_and(|key| key.ends_with("Id") || key.ends_with("Ids"))
                    && value.contains(':')
                    && !value.starts_with("evidence:") =>
            {
                references.push(value.clone());
            }
            _ => {}
        }
    }

    fn validate_story_backlinks(root: &Path) -> usize {
        let project: Value = serde_json::from_slice(
            &fs::read(root.join(".writing-buddy").join("project.json"))
                .expect("read restored project"),
        )
        .expect("parse restored project");
        let mut ids = HashSet::new();
        for chapter in project
            .get("volumes")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
            .flat_map(|volume| {
                volume
                    .get("chapters")
                    .and_then(Value::as_array)
                    .into_iter()
                    .flatten()
            })
        {
            if let Some(id) = chapter.get("id").and_then(Value::as_str) {
                ids.insert(id.to_owned());
                ids.insert(format!("chapter:{id}"));
            }
        }
        let mut values = Vec::new();
        for entry in WalkDir::new(root.join("story")).follow_links(false) {
            let entry = entry.expect("scan restored story");
            if !entry.file_type().is_file()
                || entry.path().extension().and_then(|value| value.to_str()) != Some("json")
            {
                continue;
            }
            let value: Value =
                serde_json::from_slice(&fs::read(entry.path()).expect("read story json"))
                    .expect("parse story json");
            collect_ids(&value, &mut ids);
            values.push(value);
        }
        let mut references = Vec::new();
        for value in &values {
            collect_id_references(value, None, &mut references);
        }
        let unresolved = references
            .iter()
            .filter(|reference| !ids.contains(reference.as_str()))
            .collect::<Vec<_>>();
        assert!(
            unresolved.is_empty(),
            "unresolved backlinks: {unresolved:?}"
        );
        references.len()
    }

    #[test]
    fn creates_inspects_and_restores_legacy_backup_frames() {
        let root = temp_directory("archive-project");
        let destination = temp_directory("archive-restore");
        let backup = temp_directory("archive-output").with_extension("wbbackup");
        fs::create_dir_all(root.join(".writing-buddy")).expect("metadata directory");
        fs::create_dir_all(root.join(".writing-buddy").join("cache")).expect("cache directory");
        fs::create_dir_all(root.join(".writing-buddy").join("ai").join("pending-facts"))
            .expect("pending fact directory");
        fs::create_dir_all(root.join(".writing-buddy").join("ai").join("tmp"))
            .expect("ai temp directory");
        fs::create_dir_all(root.join("chapters")).expect("chapters directory");
        fs::create_dir_all(root.join("story").join("characters")).expect("story directory");
        fs::create_dir_all(&destination).expect("restore directory");
        fs::create_dir_all(destination.join(".writing-buddy").join("cache"))
            .expect("restored cache directory");
        fs::write(
            destination
                .join(".writing-buddy")
                .join("cache")
                .join("stale.json"),
            "stale",
        )
        .expect("stale restored cache");
        fs::write(
            root.join(".writing-buddy").join("project.json"),
            r#"{"schemaVersion":1,"projectId":"project-00000001","title":"Fixture","volumes":[]}"#,
        )
        .expect("manifest");
        fs::write(root.join("chapters").join("one.md"), "夜雨。\r\n").expect("chapter");
        fs::write(
            root.join("story")
                .join("characters")
                .join("character%3Alin.json"),
            r#"{"schemaVersion":1,"id":"character:lin","type":"character"}"#,
        )
        .expect("story resource");
        fs::write(
            root.join(".writing-buddy")
                .join("ai")
                .join("pending-facts")
                .join("index.json"),
            r#"{"schemaVersion":1,"facts":[]}"#,
        )
        .expect("pending facts");
        fs::write(
            root.join(".writing-buddy")
                .join("cache")
                .join("story-index-v1.json"),
            "derived",
        )
        .expect("derived index");
        fs::write(
            root.join(".writing-buddy")
                .join("ai")
                .join("tmp")
                .join("job.json"),
            "temporary",
        )
        .expect("ai temporary file");

        let result = create(
            root.to_str().expect("root path"),
            Some(backup.to_str().expect("backup path")),
            "test",
            None,
        )
        .expect("create backup");
        assert_eq!(result.entry_count, 4);
        let (_, entries) = decode(&fs::read(&backup).expect("read backup")).expect("decode backup");
        assert!(entries.contains_key("story/characters/character%3Alin.json"));
        assert!(entries.contains_key(".writing-buddy/ai/pending-facts/index.json"));
        assert!(!entries.contains_key(".writing-buddy/cache/story-index-v1.json"));
        assert!(!entries.contains_key(".writing-buddy/ai/tmp/job.json"));
        let inspection = inspect(backup.to_str().expect("backup path"));
        assert!(inspection.valid);
        assert_eq!(inspection.project_id.as_deref(), Some("project-00000001"));
        assert_eq!(
            restore(
                backup.to_str().expect("backup path"),
                destination.to_str().expect("destination path"),
                false,
            )
            .expect("restore"),
            4
        );
        assert_eq!(
            fs::read_to_string(destination.join("chapters").join("one.md"))
                .expect("restored chapter"),
            "夜雨。\r\n"
        );
        assert!(!destination.join(".writing-buddy").join("cache").exists());

        let _ = fs::remove_dir_all(root);
        let _ = fs::remove_dir_all(destination);
        let _ = fs::remove_file(backup);
    }

    #[test]
    #[ignore = "run with STORYFORGE_REAL_PROJECT through scripts/acceptance/verify-storyforge-recovery.ps1"]
    fn sanitized_real_project_backup_restore_reopens_and_keeps_backlinks() {
        let source = std::env::var("STORYFORGE_REAL_PROJECT")
            .expect("STORYFORGE_REAL_PROJECT must name the sanitized project copy");
        let source = fs::canonicalize(source).expect("canonical sanitized project");
        let staging = temp_directory("storyforge-recovery-source");
        let destination = temp_directory("storyforge-recovery-restored");
        let backup = temp_directory("storyforge-recovery").with_extension("wbbackup");
        copy_directory(&source, &staging);
        fs::create_dir_all(staging.join(".writing-buddy").join("cache"))
            .expect("create derived cache");
        fs::create_dir_all(staging.join(".writing-buddy").join("ai").join("tmp"))
            .expect("create ai temp");
        fs::write(
            staging
                .join(".writing-buddy")
                .join("cache")
                .join("story-index-v1.json"),
            "derived",
        )
        .expect("write derived cache");
        fs::write(
            staging
                .join(".writing-buddy")
                .join("ai")
                .join("tmp")
                .join("job.json"),
            "temporary",
        )
        .expect("write ai temp");
        fs::create_dir_all(&destination).expect("create recovery destination");

        let expected = collect(&staging).expect("collect backup policy");
        let result = create(
            staging.to_str().expect("staging path"),
            Some(backup.to_str().expect("backup path")),
            "gate-f-recovery",
            Some("StoryForge Gate F"),
        )
        .expect("create real-project backup");
        let (_, encoded_entries) =
            decode(&fs::read(&backup).expect("read backup")).expect("decode backup");
        assert_eq!(encoded_entries, expected);
        assert!(
            encoded_entries
                .keys()
                .any(|path| path.starts_with("story/"))
        );
        assert!(!encoded_entries.contains_key(".writing-buddy/cache/story-index-v1.json"));
        assert!(!encoded_entries.contains_key(".writing-buddy/ai/tmp/job.json"));

        let restored_count = restore(
            backup.to_str().expect("backup path"),
            destination.to_str().expect("destination path"),
            false,
        )
        .expect("restore real-project backup");
        assert_eq!(restored_count, expected.len());
        assert_eq!(
            collect(&destination).expect("collect restored project"),
            expected
        );

        let first = crate::migration::open_project(destination.to_str().expect("destination path"))
            .expect("first restored project open");
        let second =
            crate::migration::open_project(destination.to_str().expect("destination path"))
                .expect("second restored project open");
        assert_eq!(first.project.project_id, second.project.project_id);
        assert!(!first.read_only);
        assert!(!second.read_only);
        let backlinks_checked = validate_story_backlinks(&destination);
        let chapter_hashes = expected
            .iter()
            .filter(|(path, _)| path.starts_with("chapters/") && path.ends_with(".md"))
            .map(|(path, bytes)| (path, crate::filesystem::sha256(bytes)))
            .collect::<BTreeMap<_, _>>();

        println!(
            "STORYFORGE_RECOVERY_JSON:{}",
            serde_json::json!({
                "schemaVersion": 1,
                "projectId": first.project.project_id,
                "backupEntries": result.entry_count,
                "restoredEntries": restored_count,
                "storyFiles": expected.keys().filter(|path| path.starts_with("story/")).count(),
                "chapterHashes": chapter_hashes,
                "backlinksChecked": backlinks_checked,
                "unresolvedBacklinks": 0,
                "secondLaunch": true,
                "excluded": [
                    ".writing-buddy/cache/story-index-v1.json",
                    ".writing-buddy/ai/tmp/job.json"
                ]
            })
        );

        let _ = fs::remove_dir_all(staging);
        let _ = fs::remove_dir_all(destination);
        let _ = fs::remove_file(backup);
    }
}
