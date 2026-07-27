use std::{
    collections::HashSet,
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use chrono::{DateTime, SecondsFormat, Utc};
use serde::Deserialize;
use serde_json::Value;
use tauri::State;

use crate::{AppState, commands::require_write_lock, filesystem, logging};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct MentionSaveEntry {
    pub mention: Value,
    pub expected_revision: Option<u64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct MentionAnchor {
    start: u64,
    end: u64,
    revision: u64,
    quote: String,
    before: String,
    after: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct MentionLink {
    id: String,
    resource_id: String,
    chapter_id: String,
    scene_id: Option<String>,
    anchor: MentionAnchor,
    display_text: String,
    status: String,
    revision: u64,
    created_at: String,
    updated_at: String,
}

struct PreparedMention {
    target: PathBuf,
    original: Option<Vec<u8>>,
    value: Value,
    bytes: Vec<u8>,
}

fn valid_story_id(value: &str, required_prefix: Option<&str>) -> bool {
    let Some((prefix, leaf)) = value.split_once(':') else {
        return false;
    };
    if required_prefix.is_some_and(|required| prefix != required)
        || prefix.is_empty()
        || leaf.is_empty()
        || !prefix.chars().all(|character| {
            character.is_ascii_lowercase() || character.is_ascii_digit() || character == '-'
        })
        || !leaf.chars().all(|character| {
            character.is_ascii_lowercase() || character.is_ascii_digit() || character == '-'
        })
    {
        return false;
    }
    true
}

fn validate_timestamp(value: &str) -> bool {
    value.ends_with('Z') && DateTime::parse_from_rfc3339(value).is_ok()
}

fn validate_mention(value: &Value) -> Result<MentionLink, String> {
    let mention: MentionLink =
        serde_json::from_value(value.clone()).map_err(|_| "invalidMention".to_owned())?;
    let resource_prefix = mention
        .resource_id
        .split_once(':')
        .map(|(prefix, _)| prefix);
    if !valid_story_id(&mention.id, Some("mention"))
        || !valid_story_id(&mention.resource_id, None)
        || !resource_prefix.is_some_and(|prefix| {
            matches!(
                prefix,
                "chapter"
                    | "scene"
                    | "character"
                    | "location"
                    | "faction"
                    | "item"
                    | "world-rule"
                    | "timeline-event"
                    | "relationship"
                    | "plot-thread"
                    | "foreshadowing"
                    | "information"
            )
        })
        || !valid_story_id(&mention.chapter_id, Some("chapter"))
        || mention
            .scene_id
            .as_deref()
            .is_some_and(|id| !valid_story_id(id, Some("scene")))
        || mention.anchor.end <= mention.anchor.start
        || mention.anchor.quote.is_empty()
        || mention.anchor.quote.chars().count() > 500
        || mention.anchor.before.chars().count() > 64
        || mention.anchor.after.chars().count() > 64
        || mention.display_text.is_empty()
        || mention.display_text.chars().count() > 500
        || !matches!(mention.status.as_str(), "active" | "stale")
        || !validate_timestamp(&mention.created_at)
        || !validate_timestamp(&mention.updated_at)
    {
        return Err("invalidMention".to_owned());
    }
    let _ = mention.anchor.revision;
    Ok(mention)
}

fn mention_target(root: &Path, id: &str) -> Result<PathBuf, String> {
    if !valid_story_id(id, Some("mention")) {
        return Err("invalidMentionId".to_owned());
    }
    Ok(root
        .join("story")
        .join("mentions")
        .join(format!("{}.json", id.replace(':', "%3A"))))
}

fn prepare_mention(root: &Path, entry: &MentionSaveEntry) -> Result<PreparedMention, String> {
    let mention = validate_mention(&entry.mention)?;
    let target = mention_target(root, &mention.id)?;
    let original = if target.exists() {
        Some(fs::read(&target).map_err(|_| "mentionReadFailed".to_owned())?)
    } else {
        None
    };
    let actual_revision = original
        .as_ref()
        .map(|bytes| {
            let value: Value =
                serde_json::from_slice(bytes).map_err(|_| "invalidMention".to_owned())?;
            Ok::<u64, String>(validate_mention(&value)?.revision)
        })
        .transpose()?
        .unwrap_or(0);
    let expected_revision = entry.expected_revision.unwrap_or(mention.revision);
    if expected_revision != actual_revision {
        return Err(format!("mentionRevisionConflict:{actual_revision}"));
    }
    let mut value = entry.mention.clone();
    let object = value
        .as_object_mut()
        .ok_or_else(|| "invalidMention".to_owned())?;
    object.insert("revision".to_owned(), Value::from(actual_revision + 1));
    object.insert(
        "updatedAt".to_owned(),
        Value::from(Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)),
    );
    let mut bytes =
        serde_json::to_vec_pretty(&value).map_err(|_| "mentionSerializeFailed".to_owned())?;
    if bytes.len() > 64 * 1024 {
        return Err("mentionTooLarge".to_owned());
    }
    bytes.push(b'\n');
    Ok(PreparedMention {
        target,
        original,
        value,
        bytes,
    })
}

pub fn list_links(project_root: &str) -> Result<Vec<Value>, String> {
    let root = filesystem::canonical_project_root(project_root)?;
    let directory = root.join("story").join("mentions");
    if !directory.exists() {
        return Ok(Vec::new());
    }
    let mut mentions = Vec::new();
    for entry in fs::read_dir(directory).map_err(|_| "mentionReadFailed".to_owned())? {
        let entry = entry.map_err(|_| "mentionReadFailed".to_owned())?;
        if !entry
            .file_type()
            .map(|kind| kind.is_file())
            .unwrap_or(false)
            || entry.path().extension().and_then(|value| value.to_str()) != Some("json")
        {
            continue;
        }
        let bytes = fs::read(entry.path()).map_err(|_| "mentionReadFailed".to_owned())?;
        let value: Value =
            serde_json::from_slice(&bytes).map_err(|_| "invalidMention".to_owned())?;
        validate_mention(&value)?;
        mentions.push(value);
    }
    mentions.sort_by(|left, right| {
        left.get("id")
            .and_then(Value::as_str)
            .cmp(&right.get("id").and_then(Value::as_str))
    });
    Ok(mentions)
}

pub fn save_links(project_root: &str, entries: &[MentionSaveEntry]) -> Result<Vec<Value>, String> {
    if entries.is_empty() {
        return Ok(Vec::new());
    }
    let root = filesystem::canonical_project_root(project_root)?;
    let prepared = entries
        .iter()
        .map(|entry| prepare_mention(&root, entry))
        .collect::<Result<Vec<_>, _>>()?;
    let mut targets = HashSet::new();
    if prepared
        .iter()
        .any(|mention| !targets.insert(mention.target.clone()))
    {
        return Err("duplicateMention".to_owned());
    }

    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| "clockFailed".to_owned())?
        .as_nanos();
    let transaction = root
        .join(".writing-buddy")
        .join("runtime")
        .join("mention-transactions")
        .join(format!("{}-{nonce}", std::process::id()));
    fs::create_dir_all(&transaction).map_err(|_| "mentionStagingFailed".to_owned())?;
    for (index, mention) in prepared.iter().enumerate() {
        if let Err(error) = filesystem::write_bytes_atomic(
            &transaction.join(format!("{index}.json")),
            &mention.bytes,
        ) {
            let _ = fs::remove_dir_all(&transaction);
            return Err(error);
        }
    }

    let mut committed = 0usize;
    for mention in &prepared {
        if let Err(error) = filesystem::write_bytes_atomic(&mention.target, &mention.bytes) {
            let mut rollback_failed = false;
            for previous in prepared[..committed].iter().rev() {
                let result = if let Some(bytes) = &previous.original {
                    filesystem::write_bytes_atomic(&previous.target, bytes)
                } else {
                    fs::remove_file(&previous.target)
                        .map_err(|_| "mentionRollbackFailed".to_owned())
                };
                rollback_failed |= result.is_err();
            }
            let _ = fs::remove_dir_all(&transaction);
            return Err(if rollback_failed {
                "mentionCommitRollbackFailed".to_owned()
            } else {
                error
            });
        }
        committed += 1;
    }
    let _ = fs::remove_dir_all(&transaction);
    Ok(prepared.into_iter().map(|mention| mention.value).collect())
}

#[tauri::command]
pub fn mention_list_links(project_root: String) -> Result<Vec<Value>, String> {
    list_links(&project_root)
}

#[tauri::command]
pub fn mention_save_links(
    state: State<'_, AppState>,
    project_root: String,
    entries: Vec<MentionSaveEntry>,
) -> Result<Vec<Value>, String> {
    require_write_lock(&state, &project_root)?;
    let _transaction = state
        .story_transactions
        .lock()
        .map_err(|_| "storyTransactionLockPoisoned".to_owned())?;
    let saved = save_links(&project_root, &entries)?;
    logging::event("story.mentions.changed", "info", None, None);
    Ok(saved)
}
