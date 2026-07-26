use std::{
    fs,
    path::{Path, PathBuf},
};

use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};
use tauri::State;
use walkdir::WalkDir;

use crate::{
    AppState,
    archive::{self, BackupInspection, BackupResult},
    filesystem::{self, AtomicWriteRequest, AtomicWriteResult, TextFile},
    logging,
    migration::{self, ProjectSnapshot},
    process_lock, secrets,
};

#[derive(Debug, Deserialize)]
pub struct AiMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
pub struct AiCompleteRequest {
    model: String,
    messages: Vec<AiMessage>,
}

#[derive(Debug, Deserialize)]
struct DeepSeekResponse {
    choices: Vec<DeepSeekChoice>,
}

#[derive(Debug, Deserialize)]
struct DeepSeekChoice {
    message: DeepSeekMessage,
}

#[derive(Debug, Deserialize)]
struct DeepSeekMessage {
    content: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionSummary {
    id: String,
    created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    label: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionText {
    snapshot_id: String,
    relative_path: String,
    content: String,
    hash: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SnapshotManifest {
    id: String,
    project_id: String,
    resources: Vec<SnapshotResource>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SnapshotResource {
    relative_path: String,
    blob_hash: String,
    content_hash: String,
}

fn require_write_lock(state: &AppState, project_root: &str) -> Result<(), String> {
    let root = filesystem::canonical_project_root(project_root)?;
    let locks = state.locks.lock().map_err(|_| "lockPoisoned".to_owned())?;
    if locks.contains_key(&root) {
        Ok(())
    } else {
        Err("projectReadOnly".to_owned())
    }
}

#[tauri::command]
pub fn choose_project() -> Option<String> {
    rfd::FileDialog::new()
        .set_title("选择 Writing Buddy 项目副本")
        .pick_folder()
        .map(|path| path.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn open_project(
    state: State<'_, AppState>,
    project_root: String,
) -> Result<ProjectSnapshot, String> {
    let snapshot = migration::open_project(&project_root)?;
    if !snapshot.read_only {
        process_lock::acquire(&state, &snapshot.root)?;
    }
    let project_token = hex::encode(Sha256::digest(snapshot.project.project_id.as_bytes()));
    logging::event("project.open", "info", Some(&project_token[..12]), None);
    Ok(snapshot)
}

#[tauri::command]
pub fn read_text(project_root: String, relative_path: String) -> Result<TextFile, String> {
    filesystem::read_text(&project_root, &relative_path)
}

#[tauri::command]
pub fn write_text_atomic(
    state: State<'_, AppState>,
    request: AtomicWriteRequest,
) -> Result<AtomicWriteResult, String> {
    require_write_lock(&state, &request.project_root)?;
    filesystem::write_text_atomic(&request)
}

#[tauri::command]
pub fn save_text_as(
    content: String,
    eol: String,
    has_bom: bool,
    suggested_name: String,
) -> Result<Option<String>, String> {
    let file_name = Path::new(&suggested_name)
        .file_name()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .unwrap_or("chapter.md");
    let Some(path) = rfd::FileDialog::new()
        .set_title("将写作副本另存为")
        .set_file_name(file_name)
        .add_filter("Markdown", &["md"])
        .save_file()
    else {
        return Ok(None);
    };
    let bytes = filesystem::encode_text(&content, &eol, has_bom)?;
    filesystem::write_bytes_atomic(&path, &bytes)?;
    Ok(Some(path.to_string_lossy().into_owned()))
}

#[tauri::command]
pub fn read_resource(project_root: String, relative_path: String) -> Result<String, String> {
    Ok(filesystem::read_text(&project_root, &relative_path)?.content)
}

#[tauri::command]
pub fn write_resource(
    state: State<'_, AppState>,
    project_root: String,
    relative_path: String,
    content: String,
    expected_hash: String,
) -> Result<AtomicWriteResult, String> {
    require_write_lock(&state, &project_root)?;
    if !relative_path.starts_with("references/") {
        return Err("resourcePathRejected".to_owned());
    }
    filesystem::write_text_atomic(&AtomicWriteRequest {
        project_root,
        relative_path,
        content,
        expected_hash,
        eol: "lf".to_owned(),
        has_bom: false,
        force: false,
    })
}

fn snapshot_kind(relative: &str) -> Option<&'static str> {
    let lower = relative.to_ascii_lowercase();
    if lower == ".writing-buddy/project.json" {
        Some("projectManifest")
    } else if lower.starts_with("chapters/") && lower.ends_with(".md") {
        Some("chapter")
    } else if lower.starts_with("references/notes/") {
        Some("note")
    } else if lower.starts_with("references/characters/") {
        Some("character")
    } else if lower.starts_with("references/worldbuilding/") {
        Some("worldbuilding")
    } else if lower == "references/timeline.json" {
        Some("timeline")
    } else if lower.starts_with("references/items/") {
        Some("item")
    } else if lower.starts_with(".writing-buddy/review/") {
        Some("reviewState")
    } else if lower.starts_with(".writing-buddy/ai/") {
        Some("aiState")
    } else if lower.starts_with(".writing-buddy/trash/") {
        Some("trashMetadata")
    } else {
        None
    }
}

fn snapshot_id_is_safe(snapshot_id: &str) -> bool {
    snapshot_id.starts_with("snapshot-")
        && snapshot_id.len() <= 96
        && snapshot_id
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '-')
}

fn snapshot_paths(project_root: &str, snapshot_id: &str) -> Result<(PathBuf, PathBuf), String> {
    if !snapshot_id_is_safe(snapshot_id) {
        return Err("invalidSnapshotId".to_owned());
    }
    let root = filesystem::canonical_project_root(project_root)?;
    let history = root.join(".writing-buddy").join("history");
    Ok((
        history
            .join("manifests")
            .join(format!("{snapshot_id}.json")),
        history.join("blobs"),
    ))
}

fn load_snapshot(
    project_root: &str,
    snapshot_id: &str,
) -> Result<(SnapshotManifest, PathBuf), String> {
    let (manifest_path, blobs) = snapshot_paths(project_root, snapshot_id)?;
    let bytes = fs::read(manifest_path).map_err(|_| "snapshotNotFound".to_owned())?;
    let manifest: SnapshotManifest =
        serde_json::from_slice(&bytes).map_err(|_| "snapshotInvalid".to_owned())?;
    if manifest.id != snapshot_id {
        return Err("snapshotInvalid".to_owned());
    }
    Ok((manifest, blobs))
}

#[tauri::command]
pub fn create_snapshot(
    state: State<'_, AppState>,
    project_root: String,
    reason: String,
    label: Option<String>,
) -> Result<String, String> {
    require_write_lock(&state, &project_root)?;
    let allowed = [
        "manual",
        "periodic",
        "beforeRestore",
        "beforeMigration",
        "beforeDestructiveOperation",
        "milestone",
    ];
    if !allowed.contains(&reason.as_str()) {
        return Err("invalidSnapshotReason".to_owned());
    }
    let root = filesystem::canonical_project_root(&project_root)?;
    let project_bytes = fs::read(root.join(".writing-buddy").join("project.json"))
        .map_err(|_| "manifestReadFailed".to_owned())?;
    let project: migration::WritingProject =
        serde_json::from_slice(&project_bytes).map_err(|_| "invalidManifest".to_owned())?;
    let history = root.join(".writing-buddy").join("history");
    let blobs = history.join("blobs");
    let manifests = history.join("manifests");
    fs::create_dir_all(&blobs).map_err(|_| "snapshotDirectoryFailed".to_owned())?;
    fs::create_dir_all(&manifests).map_err(|_| "snapshotDirectoryFailed".to_owned())?;
    let mut resources = Vec::new();
    let mut total_bytes = 0_usize;
    let mut new_blob_bytes = 0_usize;
    for entry in WalkDir::new(&root)
        .follow_links(false)
        .into_iter()
        .filter_map(Result::ok)
    {
        if !entry.file_type().is_file() {
            continue;
        }
        let relative = entry
            .path()
            .strip_prefix(&root)
            .map_err(|_| "unsafePath".to_owned())?
            .components()
            .map(|component| component.as_os_str().to_string_lossy())
            .collect::<Vec<_>>()
            .join("/");
        let Some(kind) = snapshot_kind(&relative) else {
            continue;
        };
        let bytes = fs::read(entry.path()).map_err(|_| "snapshotReadFailed".to_owned())?;
        let hash = filesystem::sha256(&bytes);
        let blob = blobs.join(&hash);
        if !blob.exists() {
            filesystem::write_bytes_atomic(&blob, &bytes)?;
            new_blob_bytes += bytes.len();
        }
        total_bytes += bytes.len();
        let resource_id = entry
            .path()
            .file_stem()
            .and_then(|value| value.to_str())
            .unwrap_or("resource");
        resources.push(json!({
            "resourceId": resource_id,
            "kind": kind,
            "relativePath": relative,
            "blobHash": hash,
            "byteLength": bytes.len(),
            "contentHash": hash
        }));
    }
    resources.sort_by(|left, right| {
        left["relativePath"]
            .as_str()
            .cmp(&right["relativePath"].as_str())
    });
    let nonce = hex::encode(Sha256::digest(
        format!("{}:{reason}", Utc::now()).as_bytes(),
    ));
    let id = format!("snapshot-{}", &nonce[..16]);
    let created_at = Utc::now().to_rfc3339();
    let hash_source =
        serde_json::to_vec(&resources).map_err(|_| "snapshotSerializeFailed".to_owned())?;
    let manifest_hash = filesystem::sha256(&hash_source);
    let manifest = json!({
        "schemaVersion": 1,
        "id": id,
        "projectId": project.project_id,
        "createdAt": created_at,
        "reason": reason,
        "label": label,
        "appVersion": env!("CARGO_PKG_VERSION"),
        "projectSchemaVersion": project.schema_version,
        "manifestHash": manifest_hash,
        "summary": {
            "added": resources.len(),
            "modified": 0,
            "deleted": 0,
            "unchanged": 0,
            "totalBytes": total_bytes,
            "newBlobBytes": new_blob_bytes
        },
        "resources": resources
    });
    let bytes =
        serde_json::to_vec_pretty(&manifest).map_err(|_| "snapshotSerializeFailed".to_owned())?;
    filesystem::write_bytes_atomic(&manifests.join(format!("{id}.json")), &bytes)?;
    Ok(id)
}

#[tauri::command]
pub fn list_versions(project_root: String) -> Result<Vec<VersionSummary>, String> {
    let root = filesystem::canonical_project_root(&project_root)?;
    let directory = root
        .join(".writing-buddy")
        .join("history")
        .join("manifests");
    if !directory.exists() {
        return Ok(Vec::new());
    }
    let mut result = Vec::new();
    for entry in fs::read_dir(directory)
        .map_err(|_| "versionListFailed".to_owned())?
        .filter_map(Result::ok)
    {
        if entry.path().extension().and_then(|value| value.to_str()) != Some("json") {
            continue;
        }
        let value: serde_json::Value = match fs::read(&entry.path())
            .ok()
            .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        {
            Some(value) => value,
            None => continue,
        };
        let Some(id) = value.get("id").and_then(serde_json::Value::as_str) else {
            continue;
        };
        let Some(created_at) = value.get("createdAt").and_then(serde_json::Value::as_str) else {
            continue;
        };
        result.push(VersionSummary {
            id: id.to_owned(),
            created_at: created_at.to_owned(),
            label: value
                .get("label")
                .and_then(serde_json::Value::as_str)
                .map(ToOwned::to_owned),
        });
    }
    result.sort_by(|left, right| right.created_at.cmp(&left.created_at));
    Ok(result)
}

#[tauri::command]
pub fn read_version_text(
    project_root: String,
    snapshot_id: String,
    relative_path: String,
) -> Result<VersionText, String> {
    let relative = filesystem::safe_relative_path(&relative_path)?;
    let normalized = relative
        .components()
        .map(|component| component.as_os_str().to_string_lossy())
        .collect::<Vec<_>>()
        .join("/");
    let (manifest, blobs) = load_snapshot(&project_root, &snapshot_id)?;
    let entry = manifest
        .resources
        .iter()
        .find(|entry| entry.relative_path == normalized)
        .ok_or_else(|| "snapshotResourceNotFound".to_owned())?;
    if entry.blob_hash != entry.content_hash
        || entry.blob_hash.len() != 64
        || !entry
            .blob_hash
            .chars()
            .all(|character| character.is_ascii_hexdigit())
    {
        return Err("snapshotInvalid".to_owned());
    }
    let bytes =
        fs::read(blobs.join(&entry.blob_hash)).map_err(|_| "snapshotBlobMissing".to_owned())?;
    if filesystem::sha256(&bytes) != entry.blob_hash {
        return Err("snapshotChecksumMismatch".to_owned());
    }
    let text = filesystem::decode_text_bytes(&bytes)?;
    Ok(VersionText {
        snapshot_id,
        relative_path: normalized,
        content: text.content,
        hash: text.hash,
    })
}

#[tauri::command]
pub fn restore_version(
    state: State<'_, AppState>,
    project_root: String,
    snapshot_id: String,
) -> Result<usize, String> {
    require_write_lock(&state, &project_root)?;
    let root = filesystem::canonical_project_root(&project_root)?;
    let current_project: migration::WritingProject = serde_json::from_slice(
        &fs::read(root.join(".writing-buddy").join("project.json"))
            .map_err(|_| "manifestReadFailed".to_owned())?,
    )
    .map_err(|_| "invalidManifest".to_owned())?;
    let (manifest, blobs) = load_snapshot(&project_root, &snapshot_id)?;
    if manifest.project_id != current_project.project_id {
        return Err("snapshotProjectMismatch".to_owned());
    }

    let mut prepared = Vec::with_capacity(manifest.resources.len());
    for entry in manifest.resources {
        let relative = filesystem::safe_relative_path(&entry.relative_path)?;
        if snapshot_kind(&entry.relative_path).is_none()
            || entry.blob_hash != entry.content_hash
            || entry.blob_hash.len() != 64
            || !entry
                .blob_hash
                .chars()
                .all(|character| character.is_ascii_hexdigit())
        {
            return Err("snapshotInvalid".to_owned());
        }
        let bytes =
            fs::read(blobs.join(&entry.blob_hash)).map_err(|_| "snapshotBlobMissing".to_owned())?;
        if filesystem::sha256(&bytes) != entry.blob_hash {
            return Err("snapshotChecksumMismatch".to_owned());
        }
        prepared.push((relative, bytes));
    }

    archive::create(
        &project_root,
        None,
        "beforeRestore",
        Some("自动：版本恢复前"),
    )?;
    for (relative, bytes) in &prepared {
        let (_, target) = filesystem::resolve_for_write(
            &project_root,
            &relative
                .components()
                .map(|component| component.as_os_str().to_string_lossy())
                .collect::<Vec<_>>()
                .join("/"),
        )?;
        filesystem::write_bytes_atomic(&target, bytes)?;
    }
    Ok(prepared.len())
}

#[tauri::command]
pub fn read_review_state(project_root: String) -> Result<Option<TextFile>, String> {
    match filesystem::read_text(&project_root, ".writing-buddy/review/next-issues.json") {
        Ok(file) => Ok(Some(file)),
        Err(error) if error == "resourceNotFound" => Ok(None),
        Err(error) => Err(error),
    }
}

#[tauri::command]
pub fn write_review_state(
    state: State<'_, AppState>,
    project_root: String,
    content: String,
    expected_hash: String,
) -> Result<AtomicWriteResult, String> {
    require_write_lock(&state, &project_root)?;
    if content.len() > 2 * 1024 * 1024 {
        return Err("reviewStateTooLarge".to_owned());
    }
    let parsed: serde_json::Value =
        serde_json::from_str(&content).map_err(|_| "reviewStateInvalid".to_owned())?;
    if parsed
        .get("schemaVersion")
        .and_then(serde_json::Value::as_u64)
        != Some(1)
        || !parsed
            .get("issues")
            .is_some_and(serde_json::Value::is_array)
    {
        return Err("reviewStateInvalid".to_owned());
    }
    filesystem::write_text_atomic(&AtomicWriteRequest {
        project_root,
        relative_path: ".writing-buddy/review/next-issues.json".to_owned(),
        content,
        expected_hash,
        eol: "lf".to_owned(),
        has_bom: false,
        force: false,
    })
}

#[tauri::command]
pub fn create_backup(
    state: State<'_, AppState>,
    project_root: String,
    destination: Option<String>,
) -> Result<BackupResult, String> {
    require_write_lock(&state, &project_root)?;
    if destination.is_some() {
        return Err("customBackupDestinationRequiresNativeDialog".to_owned());
    }
    let result = archive::create(&project_root, None, "manual", None)?;
    if let Ok(path) = fs::canonicalize(&result.path) {
        state
            .approved_backups
            .lock()
            .map_err(|_| "lockPoisoned".to_owned())?
            .insert(path);
    }
    Ok(result)
}

#[tauri::command]
pub fn choose_backup(state: State<'_, AppState>) -> Result<Option<String>, String> {
    let Some(path) = rfd::FileDialog::new()
        .set_title("选择 Writing Buddy 备份")
        .add_filter("Writing Buddy Backup", &["wbbackup"])
        .pick_file()
    else {
        return Ok(None);
    };
    let path = fs::canonicalize(path).map_err(|_| "backupPathRejected".to_owned())?;
    if path.extension().and_then(|value| value.to_str()) != Some("wbbackup") {
        return Err("backupPathRejected".to_owned());
    }
    state
        .approved_backups
        .lock()
        .map_err(|_| "lockPoisoned".to_owned())?
        .insert(path.clone());
    Ok(Some(path.to_string_lossy().into_owned()))
}

fn backup_is_approved(state: &AppState, path: &str) -> bool {
    fs::canonicalize(path).ok().is_some_and(|candidate| {
        candidate.extension().and_then(|value| value.to_str()) == Some("wbbackup")
            && state
                .approved_backups
                .lock()
                .ok()
                .is_some_and(|approved| approved.contains(&candidate))
    })
}

#[tauri::command]
pub fn inspect_backup(state: State<'_, AppState>, path: String) -> BackupInspection {
    if !backup_is_approved(&state, &path) {
        return BackupInspection {
            valid: false,
            format_version: None,
            project_id: None,
            created_at: None,
            entry_count: 0,
            issues: vec!["backupPathRejected".to_owned()],
        };
    }
    archive::inspect(&path)
}

#[tauri::command]
pub fn restore_backup(
    state: State<'_, AppState>,
    path: String,
    project_root: String,
    overwrite: bool,
) -> Result<usize, String> {
    require_write_lock(&state, &project_root)?;
    if !backup_is_approved(&state, &path) {
        return Err("backupPathRejected".to_owned());
    }
    create_snapshot(
        state,
        project_root.clone(),
        "beforeRestore".to_owned(),
        Some("自动：恢复前".to_owned()),
    )?;
    archive::restore(&path, &project_root, overwrite)
}

#[tauri::command]
pub fn set_secret(key: String, value: String) -> Result<(), String> {
    if key != "deepseek-api-key" {
        return Err("invalidSecretKey".to_owned());
    }
    secrets::set(&key, &value)
}

#[tauri::command]
pub fn delete_secret(key: String) -> Result<(), String> {
    if key != "deepseek-api-key" {
        return Err("invalidSecretKey".to_owned());
    }
    secrets::delete(&key)
}

#[tauri::command]
pub fn secret_exists(key: String) -> Result<bool, String> {
    if key != "deepseek-api-key" {
        return Err("invalidSecretKey".to_owned());
    }
    Ok(secrets::get(&key)?.is_some())
}

#[tauri::command]
pub async fn ai_complete(request: AiCompleteRequest) -> Result<String, String> {
    let allowed_models = ["deepseek-chat", "deepseek-reasoner"];
    if !allowed_models.contains(&request.model.as_str())
        || request.messages.is_empty()
        || request.messages.len() > 20
        || request
            .messages
            .iter()
            .map(|message| message.content.chars().count())
            .sum::<usize>()
            > 20_000
        || request
            .messages
            .iter()
            .any(|message| !matches!(message.role.as_str(), "system" | "user" | "assistant"))
    {
        return Err("aiRequestRejected".to_owned());
    }
    let key = secrets::get("deepseek-api-key")?.ok_or_else(|| "aiNotConfigured".to_owned())?;
    let messages = request
        .messages
        .into_iter()
        .map(|message| json!({ "role": message.role, "content": message.content }))
        .collect::<Vec<_>>();
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| "aiClientFailed".to_owned())?;
    let response = client
        .post("https://api.deepseek.com/chat/completions")
        .bearer_auth(key)
        .json(&json!({
            "model": request.model,
            "messages": messages,
            "stream": false,
            "response_format": { "type": "json_object" }
        }))
        .send()
        .await
        .map_err(|_| "aiNetworkFailed".to_owned())?;
    if !response.status().is_success() {
        return Err(format!("aiHttpStatus:{}", response.status().as_u16()));
    }
    let body: DeepSeekResponse = response
        .json()
        .await
        .map_err(|_| "aiInvalidResponse".to_owned())?;
    body.choices
        .into_iter()
        .next()
        .map(|choice| choice.message.content)
        .ok_or_else(|| "aiInvalidResponse".to_owned())
}
