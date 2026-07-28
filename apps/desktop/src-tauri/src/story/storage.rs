use std::{
    collections::HashSet,
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use chrono::{SecondsFormat, Utc};
use serde::Deserialize;
use serde_json::Value;

use crate::filesystem;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorySaveEntry {
    pub resource: Value,
    pub expected_revision: Option<u64>,
    #[serde(default)]
    pub expected_absent: bool,
}

pub(crate) struct PreparedResource {
    pub(crate) target: PathBuf,
    pub(crate) original: Option<Vec<u8>>,
    pub(crate) value: Value,
    pub(crate) bytes: Vec<u8>,
}

fn resource_folder(resource_type: &str) -> Option<(&'static str, &'static str)> {
    match resource_type {
        "chapter" => Some(("chapters", "chapter")),
        "scene" => Some(("scenes", "scene")),
        "character" => Some(("characters", "character")),
        "location" => Some(("locations", "location")),
        "faction" => Some(("factions", "faction")),
        "item" => Some(("items", "item")),
        "worldRule" => Some(("world-rules", "world-rule")),
        "timelineEvent" => Some(("events", "timeline-event")),
        "relationship" => Some(("relationships", "relationship")),
        "plotThread" => Some(("plot-threads", "plot-thread")),
        "foreshadowing" => Some(("foreshadowing", "foreshadowing")),
        "information" => Some(("information", "information")),
        _ => None,
    }
}

fn validate_identity(resource_type: &str, id: &str) -> Result<(), String> {
    let (_, prefix) =
        resource_folder(resource_type).ok_or_else(|| "invalidStoryResourceType".to_owned())?;
    let leaf = id
        .strip_prefix(&format!("{prefix}:"))
        .ok_or_else(|| "invalidStoryId".to_owned())?;
    if leaf.is_empty()
        || !leaf.chars().all(|character| {
            character.is_ascii_lowercase() || character.is_ascii_digit() || character == '-'
        })
    {
        return Err("invalidStoryId".to_owned());
    }
    let lower = leaf.to_ascii_lowercase();
    let reserved = matches!(lower.as_str(), "con" | "prn" | "aux" | "nul")
        || (lower.len() == 4
            && (lower.starts_with("com") || lower.starts_with("lpt"))
            && lower.ends_with(|character: char| ('1'..='9').contains(&character)));
    if reserved {
        return Err("reservedStoryId".to_owned());
    }
    Ok(())
}

fn resource_target(root: &Path, resource_type: &str, id: &str) -> Result<PathBuf, String> {
    validate_identity(resource_type, id)?;
    let (folder, _) =
        resource_folder(resource_type).ok_or_else(|| "invalidStoryResourceType".to_owned())?;
    Ok(root
        .join("story")
        .join(folder)
        .join(format!("{}.json", id.replace(':', "%3A"))))
}

fn trash_target(root: &Path, resource_type: &str, id: &str) -> Result<PathBuf, String> {
    validate_identity(resource_type, id)?;
    let (folder, _) =
        resource_folder(resource_type).ok_or_else(|| "invalidStoryResourceType".to_owned())?;
    Ok(root
        .join(".writing-buddy")
        .join("trash")
        .join("story")
        .join(folder)
        .join(format!("{}.json", id.replace(':', "%3A"))))
}

fn validate_resource<'a>(value: &'a Value) -> Result<(&'a str, &'a str, u64), String> {
    let object = value
        .as_object()
        .ok_or_else(|| "invalidStoryResource".to_owned())?;
    if object.get("schemaVersion").and_then(Value::as_u64) != Some(1) {
        return Err("unsupportedStorySchema".to_owned());
    }
    let resource_type = object
        .get("type")
        .and_then(Value::as_str)
        .ok_or_else(|| "invalidStoryResourceType".to_owned())?;
    let id = object
        .get("id")
        .and_then(Value::as_str)
        .ok_or_else(|| "invalidStoryId".to_owned())?;
    validate_identity(resource_type, id)?;
    if object
        .get("title")
        .and_then(Value::as_str)
        .is_none_or(|title| title.trim().is_empty())
    {
        return Err("invalidStoryTitle".to_owned());
    }
    if object.get("createdAt").and_then(Value::as_str).is_none()
        || object.get("updatedAt").and_then(Value::as_str).is_none()
    {
        return Err("invalidStoryTimestamp".to_owned());
    }
    let revision = object
        .get("revision")
        .and_then(Value::as_u64)
        .ok_or_else(|| "invalidStoryRevision".to_owned())?;
    Ok((resource_type, id, revision))
}

fn read_value(path: &Path) -> Result<Value, String> {
    let bytes = fs::read(path).map_err(|_| "storyReadFailed".to_owned())?;
    serde_json::from_slice(&bytes).map_err(|_| "invalidStoryResource".to_owned())
}

pub(crate) fn prepare_resource(
    root: &Path,
    entry: &StorySaveEntry,
) -> Result<PreparedResource, String> {
    let (resource_type, id, incoming_revision) = validate_resource(&entry.resource)?;
    let target = resource_target(root, resource_type, id)?;
    let original = if target.exists() {
        Some(fs::read(&target).map_err(|_| "storyReadFailed".to_owned())?)
    } else {
        None
    };
    let actual_revision = original
        .as_ref()
        .map(|bytes| {
            serde_json::from_slice::<Value>(bytes)
                .map_err(|_| "invalidStoryResource".to_owned())
                .and_then(|value| {
                    validate_resource(&value)?;
                    value
                        .get("revision")
                        .and_then(Value::as_u64)
                        .ok_or_else(|| "invalidStoryRevision".to_owned())
                })
        })
        .transpose()?
        .unwrap_or(0);
    if entry.expected_absent && original.is_some() {
        return Err(format!("storyRevisionConflict:{actual_revision}"));
    }
    let expected_revision = entry.expected_revision.unwrap_or(incoming_revision);
    if actual_revision != expected_revision {
        return Err(format!("storyRevisionConflict:{actual_revision}"));
    }

    let mut value = entry.resource.clone();
    let object = value
        .as_object_mut()
        .ok_or_else(|| "invalidStoryResource".to_owned())?;
    object.insert("revision".to_owned(), Value::from(actual_revision + 1));
    object.insert(
        "updatedAt".to_owned(),
        Value::from(Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)),
    );
    let mut bytes =
        serde_json::to_vec_pretty(&value).map_err(|_| "storySerializeFailed".to_owned())?;
    bytes.push(b'\n');
    Ok(PreparedResource {
        target,
        original,
        value,
        bytes,
    })
}

pub fn get_resource(
    project_root: &str,
    resource_type: &str,
    id: &str,
) -> Result<Option<Value>, String> {
    let root = filesystem::canonical_project_root(project_root)?;
    let target = resource_target(&root, resource_type, id)?;
    if !target.exists() {
        return Ok(None);
    }
    let value = read_value(&target)?;
    let (actual_type, actual_id, _) = validate_resource(&value)?;
    if actual_type != resource_type || actual_id != id {
        return Err("storyIdentityMismatch".to_owned());
    }
    Ok(Some(value))
}

pub fn list_resources(project_root: &str, resource_type: &str) -> Result<Vec<Value>, String> {
    let root = filesystem::canonical_project_root(project_root)?;
    let (folder, _) =
        resource_folder(resource_type).ok_or_else(|| "invalidStoryResourceType".to_owned())?;
    let directory = root.join("story").join(folder);
    if !directory.exists() {
        return Ok(Vec::new());
    }
    let mut values = Vec::new();
    for entry in fs::read_dir(directory).map_err(|_| "storyReadFailed".to_owned())? {
        let entry = entry.map_err(|_| "storyReadFailed".to_owned())?;
        if !entry
            .file_type()
            .map(|kind| kind.is_file())
            .unwrap_or(false)
            || entry.path().extension().and_then(|value| value.to_str()) != Some("json")
        {
            continue;
        }
        let value = read_value(&entry.path())?;
        let (actual_type, _, _) = validate_resource(&value)?;
        if actual_type != resource_type {
            return Err("storyIdentityMismatch".to_owned());
        }
        values.push(value);
    }
    values.sort_by(|left, right| {
        left.get("id")
            .and_then(Value::as_str)
            .cmp(&right.get("id").and_then(Value::as_str))
    });
    Ok(values)
}

pub fn save_resources(
    project_root: &str,
    entries: &[StorySaveEntry],
) -> Result<Vec<Value>, String> {
    if entries.is_empty() {
        return Ok(Vec::new());
    }
    let root = filesystem::canonical_project_root(project_root)?;
    let prepared = entries
        .iter()
        .map(|entry| prepare_resource(&root, entry))
        .collect::<Result<Vec<_>, _>>()?;
    let mut targets = HashSet::new();
    if prepared
        .iter()
        .any(|resource| !targets.insert(resource.target.clone()))
    {
        return Err("duplicateStoryResource".to_owned());
    }

    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| "clockFailed".to_owned())?
        .as_nanos();
    let transaction = root
        .join(".writing-buddy")
        .join("runtime")
        .join("story-transactions")
        .join(format!("{}-{nonce}", std::process::id()));
    fs::create_dir_all(&transaction).map_err(|_| "storyStagingFailed".to_owned())?;
    let staged = prepared
        .iter()
        .enumerate()
        .map(|(index, resource)| {
            let path = transaction.join(format!("{index}.json"));
            filesystem::write_bytes_atomic(&path, &resource.bytes)?;
            Ok(path)
        })
        .collect::<Result<Vec<_>, String>>();
    if let Err(error) = staged {
        let _ = fs::remove_dir_all(&transaction);
        return Err(error);
    }

    let mut committed = 0usize;
    for resource in &prepared {
        if let Err(error) = filesystem::write_bytes_atomic(&resource.target, &resource.bytes) {
            let mut rollback_failed = false;
            for previous in prepared[..committed].iter().rev() {
                let result = if let Some(bytes) = &previous.original {
                    filesystem::write_bytes_atomic(&previous.target, bytes)
                } else {
                    fs::remove_file(&previous.target).map_err(|_| "storyRollbackFailed".to_owned())
                };
                rollback_failed |= result.is_err();
            }
            let _ = fs::remove_dir_all(&transaction);
            return Err(if rollback_failed {
                "storyCommitRollbackFailed".to_owned()
            } else {
                error
            });
        }
        committed += 1;
    }
    let _ = fs::remove_dir_all(&transaction);
    Ok(prepared
        .into_iter()
        .map(|resource| resource.value)
        .collect())
}

pub fn move_to_trash(project_root: &str, resource_type: &str, id: &str) -> Result<(), String> {
    let root = filesystem::canonical_project_root(project_root)?;
    let target = resource_target(&root, resource_type, id)?;
    if !target.exists() {
        return Err("storyResourceNotFound".to_owned());
    }
    let bytes = fs::read(&target).map_err(|_| "storyReadFailed".to_owned())?;
    let trash = trash_target(&root, resource_type, id)?;
    filesystem::write_bytes_atomic(&trash, &bytes)?;
    fs::remove_file(target).map_err(|_| "storyTrashMoveFailed".to_owned())
}

pub fn restore_from_trash(
    project_root: &str,
    resource_type: &str,
    id: &str,
) -> Result<Value, String> {
    let root = filesystem::canonical_project_root(project_root)?;
    let target = resource_target(&root, resource_type, id)?;
    if target.exists() {
        return Err("storyResourceAlreadyExists".to_owned());
    }
    let trash = trash_target(&root, resource_type, id)?;
    if !trash.exists() {
        return Err("storyTrashNotFound".to_owned());
    }
    let bytes = fs::read(&trash).map_err(|_| "storyReadFailed".to_owned())?;
    let value: Value =
        serde_json::from_slice(&bytes).map_err(|_| "invalidStoryResource".to_owned())?;
    let (actual_type, actual_id, _) = validate_resource(&value)?;
    if actual_type != resource_type || actual_id != id {
        return Err("storyIdentityMismatch".to_owned());
    }
    filesystem::write_bytes_atomic(&target, &bytes)?;
    fs::remove_file(trash).map_err(|_| "storyTrashRestoreFailed".to_owned())?;
    Ok(value)
}
