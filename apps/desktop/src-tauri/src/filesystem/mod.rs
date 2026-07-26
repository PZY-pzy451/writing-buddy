use std::{
    ffi::OsStr,
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    path::{Component, Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TextFile {
    pub content: String,
    pub encoding: &'static str,
    pub eol: &'static str,
    pub has_bom: bool,
    pub hash: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AtomicWriteRequest {
    pub project_root: String,
    pub relative_path: String,
    pub content: String,
    pub expected_hash: String,
    pub eol: String,
    pub has_bom: bool,
    #[serde(default)]
    pub force: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AtomicWriteResult {
    pub hash: String,
    pub byte_length: usize,
    pub modified_at: String,
}

pub fn sha256(bytes: &[u8]) -> String {
    hex::encode(Sha256::digest(bytes))
}

pub fn canonical_project_root(project_root: &str) -> Result<PathBuf, String> {
    let root = fs::canonicalize(project_root).map_err(|_| "projectRootUnavailable".to_owned())?;
    let metadata = fs::metadata(&root).map_err(|_| "projectRootUnavailable".to_owned())?;
    if !metadata.is_dir() {
        return Err("projectRootUnavailable".to_owned());
    }
    Ok(root)
}

pub fn safe_relative_path(relative_path: &str) -> Result<PathBuf, String> {
    if relative_path.is_empty()
        || relative_path.contains('\0')
        || relative_path.contains('\\')
        || relative_path.starts_with('/')
    {
        return Err("unsafePath".to_owned());
    }
    let path = Path::new(relative_path);
    for component in path.components() {
        if !matches!(component, Component::Normal(_)) {
            return Err("unsafePath".to_owned());
        }
    }
    Ok(path.to_path_buf())
}

pub fn resolve_existing(
    project_root: &str,
    relative_path: &str,
) -> Result<(PathBuf, PathBuf), String> {
    let root = canonical_project_root(project_root)?;
    let relative = safe_relative_path(relative_path)?;
    let target =
        fs::canonicalize(root.join(relative)).map_err(|_| "resourceNotFound".to_owned())?;
    if !target.starts_with(&root) {
        return Err("unsafePath".to_owned());
    }
    let metadata = fs::symlink_metadata(&target).map_err(|_| "resourceNotFound".to_owned())?;
    if metadata.file_type().is_symlink() {
        return Err("unsafePath".to_owned());
    }
    Ok((root, target))
}

pub fn resolve_for_write(
    project_root: &str,
    relative_path: &str,
) -> Result<(PathBuf, PathBuf), String> {
    let root = canonical_project_root(project_root)?;
    let relative = safe_relative_path(relative_path)?;
    let target = root.join(relative);
    let parent = target.parent().ok_or_else(|| "unsafePath".to_owned())?;
    fs::create_dir_all(parent).map_err(|_| "writeFailed".to_owned())?;
    let canonical_parent = fs::canonicalize(parent).map_err(|_| "writeFailed".to_owned())?;
    if !canonical_parent.starts_with(&root) {
        return Err("unsafePath".to_owned());
    }
    if target.exists() {
        let canonical_target = fs::canonicalize(&target).map_err(|_| "writeFailed".to_owned())?;
        if !canonical_target.starts_with(&root) {
            return Err("unsafePath".to_owned());
        }
        let metadata = fs::symlink_metadata(&target).map_err(|_| "writeFailed".to_owned())?;
        if metadata.file_type().is_symlink() || !metadata.is_file() {
            return Err("unsafePath".to_owned());
        }
    }
    Ok((root, target))
}

pub fn read_text(project_root: &str, relative_path: &str) -> Result<TextFile, String> {
    let (_, target) = resolve_existing(project_root, relative_path)?;
    let bytes = fs::read(&target).map_err(|_| "readFailed".to_owned())?;
    decode_text_bytes(&bytes)
}

pub fn decode_text_bytes(bytes: &[u8]) -> Result<TextFile, String> {
    let has_bom = bytes.starts_with(&[0xef, 0xbb, 0xbf]);
    let content_bytes = if has_bom { &bytes[3..] } else { &bytes };
    let content = std::str::from_utf8(content_bytes)
        .map_err(|_| "unsupportedEncoding".to_owned())?
        .to_owned();
    let eol = if content.contains("\r\n") {
        "crlf"
    } else {
        "lf"
    };
    Ok(TextFile {
        content,
        encoding: "utf-8",
        eol,
        has_bom,
        hash: sha256(&bytes),
    })
}

pub fn encode_text(content: &str, eol: &str, has_bom: bool) -> Result<Vec<u8>, String> {
    let normalized = content.replace("\r\n", "\n").replace('\r', "\n");
    let normalized = match eol {
        "lf" => normalized,
        "crlf" => normalized.replace('\n', "\r\n"),
        _ => return Err("invalidEol".to_owned()),
    };
    let mut bytes = Vec::with_capacity(normalized.len() + if has_bom { 3 } else { 0 });
    if has_bom {
        bytes.extend_from_slice(&[0xef, 0xbb, 0xbf]);
    }
    bytes.extend_from_slice(normalized.as_bytes());
    Ok(bytes)
}

pub fn write_text_atomic(request: &AtomicWriteRequest) -> Result<AtomicWriteResult, String> {
    let (_, target) = resolve_for_write(&request.project_root, &request.relative_path)?;
    if target.exists() {
        let current = fs::read(&target).map_err(|_| "readFailed".to_owned())?;
        let actual_hash = sha256(&current);
        if !request.force && actual_hash != request.expected_hash {
            return Err(format!("externalChange:{actual_hash}"));
        }
    } else if !request.expected_hash.is_empty() && !request.force {
        return Err("externalChange:missing".to_owned());
    }
    let bytes = encode_text(&request.content, &request.eol, request.has_bom)?;
    write_bytes_atomic(&target, &bytes)?;
    let modified = fs::metadata(&target)
        .and_then(|metadata| metadata.modified())
        .unwrap_or_else(|_| SystemTime::now());
    let modified_at: DateTime<Utc> = modified.into();
    Ok(AtomicWriteResult {
        hash: sha256(&bytes),
        byte_length: bytes.len(),
        modified_at: modified_at.to_rfc3339(),
    })
}

pub fn write_bytes_atomic(target: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = target.parent().ok_or_else(|| "writeFailed".to_owned())?;
    fs::create_dir_all(parent).map_err(|_| "writeFailed".to_owned())?;
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| "clockFailed".to_owned())?
        .as_nanos();
    let staging = parent.join(format!(
        ".writing-buddy-staging-{}-{nonce}",
        std::process::id()
    ));
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&staging)
        .map_err(|_| "stagingCreateFailed".to_owned())?;
    let result = (|| -> Result<(), String> {
        file.write_all(bytes)
            .map_err(|_| "stagingWriteFailed".to_owned())?;
        file.sync_all()
            .map_err(|_| "stagingSyncFailed".to_owned())?;
        drop(file);
        replace_file(&staging, target)?;
        if let Ok(directory) = File::open(parent) {
            let _ = directory.sync_all();
        }
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&staging);
    }
    result
}

#[cfg(windows)]
fn replace_file(source: &Path, destination: &Path) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{
        MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH, MoveFileExW,
    };

    fn wide(value: &OsStr) -> Vec<u16> {
        value.encode_wide().chain(std::iter::once(0)).collect()
    }

    let source = wide(source.as_os_str());
    let destination = wide(destination.as_os_str());
    let result = unsafe {
        MoveFileExW(
            source.as_ptr(),
            destination.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };
    if result == 0 {
        return Err("atomicReplaceFailed".to_owned());
    }
    Ok(())
}

#[cfg(not(windows))]
fn replace_file(source: &Path, destination: &Path) -> Result<(), String> {
    fs::rename(source, destination).map_err(|_| "atomicReplaceFailed".to_owned())
}

pub fn read_all(mut file: File, max_bytes: u64) -> Result<Vec<u8>, String> {
    let length = file.metadata().map_err(|_| "readFailed".to_owned())?.len();
    if length > max_bytes {
        return Err("fileTooLarge".to_owned());
    }
    let mut bytes = Vec::with_capacity(length as usize);
    file.read_to_end(&mut bytes)
        .map_err(|_| "readFailed".to_owned())?;
    Ok(bytes)
}

#[cfg(test)]
mod tests {
    use std::{
        fs,
        time::{SystemTime, UNIX_EPOCH},
    };

    use super::{AtomicWriteRequest, read_text, safe_relative_path, sha256, write_text_atomic};

    fn temp_project() -> std::path::PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "writing-buddy-filesystem-{}-{nonce}",
            std::process::id()
        ));
        fs::create_dir_all(root.join("chapters")).expect("create temp project");
        root
    }

    #[test]
    fn rejects_traversal_absolute_and_windows_separator_paths() {
        for unsafe_path in ["../outside.md", "/absolute.md", "chapters\\one.md", ".", ""] {
            assert_eq!(
                safe_relative_path(unsafe_path),
                Err("unsafePath".to_owned())
            );
        }
        assert_eq!(
            safe_relative_path("chapters/第一章.md").expect("safe path"),
            std::path::PathBuf::from("chapters/第一章.md")
        );
    }

    #[test]
    fn atomically_preserves_bom_and_crlf_and_rejects_stale_hashes() {
        let root = temp_project();
        let path = root.join("chapters").join("one.md");
        let initial = b"\xef\xbb\xbffirst\r\n";
        fs::write(&path, initial).expect("write initial");
        let request = AtomicWriteRequest {
            project_root: root.to_string_lossy().into_owned(),
            relative_path: "chapters/one.md".to_owned(),
            content: "第一行\n第二行\n".to_owned(),
            expected_hash: sha256(initial),
            eol: "crlf".to_owned(),
            has_bom: true,
            force: false,
        };
        write_text_atomic(&request).expect("atomic write");
        let file = read_text(&request.project_root, &request.relative_path).expect("read result");
        assert_eq!(file.content, "第一行\r\n第二行\r\n");
        assert!(file.has_bom);
        assert_eq!(file.eol, "crlf");
        assert!(
            write_text_atomic(&request)
                .expect_err("stale write must fail")
                .starts_with("externalChange:")
        );

        let _ = fs::remove_dir_all(root);
    }
}
