use std::{
    collections::{HashMap, HashSet},
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::State;

use super::{
    commands::invalidate_cached_index,
    mentions::{MentionSaveEntry, PreparedMention, prepare_mention},
    storage::{PreparedResource, StorySaveEntry, prepare_resource},
};
use crate::{AppState, commands::require_write_lock, filesystem, logging, migration};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SceneMoveTextWrite {
    chapter_id: String,
    relative_path: String,
    content: String,
    expected_hash: String,
    eol: String,
    has_bom: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SceneMoveCommitRequest {
    project_root: String,
    command_id: String,
    scene_id: String,
    from_chapter_id: String,
    to_chapter_id: String,
    expected_project_revision: String,
    manuscripts: Vec<SceneMoveTextWrite>,
    story_entries: Vec<StorySaveEntry>,
    mention_entries: Vec<MentionSaveEntry>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneMoveManuscriptResult {
    chapter_id: String,
    relative_path: String,
    hash: String,
    byte_length: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneMoveCommitResult {
    story_resources: Vec<Value>,
    mentions: Vec<Value>,
    manuscripts: Vec<SceneMoveManuscriptResult>,
}

struct PreparedText {
    chapter_id: String,
    relative_path: String,
    target: PathBuf,
    original: Vec<u8>,
    bytes: Vec<u8>,
}

struct TransactionFile {
    target: PathBuf,
    original: Vec<u8>,
    bytes: Vec<u8>,
}

fn story_chapter_id(project_id: &str) -> Result<String, String> {
    if project_id.starts_with("chapter:")
        && project_id.strip_prefix("chapter:").is_some_and(|leaf| {
            !leaf.is_empty()
                && leaf.chars().all(|character| {
                    character.is_ascii_lowercase() || character.is_ascii_digit() || character == '-'
                })
        })
    {
        return Ok(project_id.to_owned());
    }
    let mut leaf = String::new();
    let mut previous_dash = false;
    for character in project_id.trim().to_ascii_lowercase().chars() {
        if character.is_ascii_lowercase() || character.is_ascii_digit() || character == '-' {
            if character == '-' {
                if previous_dash || leaf.is_empty() {
                    continue;
                }
                previous_dash = true;
            } else {
                previous_dash = false;
            }
            leaf.push(character);
        } else if !previous_dash && !leaf.is_empty() {
            leaf.push('-');
            previous_dash = true;
        }
    }
    while leaf.ends_with('-') {
        leaf.pop();
    }
    if leaf.is_empty() {
        return Err("sceneMoveTargetInvalid".to_owned());
    }
    Ok(format!("chapter:{leaf}"))
}

fn chapter_paths(project: &migration::WritingProject) -> Result<HashMap<String, String>, String> {
    let mut paths = HashMap::new();
    for volume in &project.volumes {
        for chapter in &volume.chapters {
            let id = story_chapter_id(&chapter.id)?;
            if paths.insert(id, chapter.file.clone()).is_some() {
                return Err("sceneMoveTargetInvalid".to_owned());
            }
        }
    }
    Ok(paths)
}

fn map_prepare_error(error: String) -> String {
    if error.starts_with("storyRevisionConflict") {
        "sceneMoveStoryRevisionConflict".to_owned()
    } else if error.starts_with("mentionRevisionConflict") {
        "sceneMoveMentionRevisionConflict".to_owned()
    } else {
        error
    }
}

fn prepare_text(
    root: &Path,
    project_root: &str,
    write: &SceneMoveTextWrite,
) -> Result<PreparedText, String> {
    let (_, target) = filesystem::resolve_existing(project_root, &write.relative_path)
        .map_err(|_| "sceneMoveTargetInvalid".to_owned())?;
    if !target.starts_with(root) {
        return Err("sceneMoveTargetInvalid".to_owned());
    }
    let original = fs::read(&target).map_err(|_| "sceneMoveTextReadFailed".to_owned())?;
    if filesystem::sha256(&original) != write.expected_hash {
        return Err("sceneMoveTextConflict".to_owned());
    }
    let bytes = filesystem::encode_text(&write.content, &write.eol, write.has_bom)
        .map_err(|_| "sceneMoveTargetInvalid".to_owned())?;
    Ok(PreparedText {
        chapter_id: write.chapter_id.clone(),
        relative_path: write.relative_path.clone(),
        target,
        original,
        bytes,
    })
}

fn validate_scope(
    request: &SceneMoveCommitRequest,
    chapter_paths: &HashMap<String, String>,
) -> Result<(), String> {
    if request.command_id.trim().is_empty()
        || !request.scene_id.starts_with("scene:")
        || !chapter_paths.contains_key(&request.from_chapter_id)
        || !chapter_paths.contains_key(&request.to_chapter_id)
        || request.manuscripts.is_empty()
        || request.story_entries.is_empty()
    {
        return Err("sceneMoveTargetInvalid".to_owned());
    }
    let affected = HashSet::from([
        request.from_chapter_id.as_str(),
        request.to_chapter_id.as_str(),
    ]);
    let expected_manuscripts = affected.len();
    if request.manuscripts.len() != expected_manuscripts {
        return Err("sceneMoveTargetInvalid".to_owned());
    }
    let mut chapters = HashSet::new();
    for write in &request.manuscripts {
        if !affected.contains(write.chapter_id.as_str())
            || chapter_paths.get(&write.chapter_id) != Some(&write.relative_path)
            || !chapters.insert(write.chapter_id.as_str())
        {
            return Err("sceneMoveTargetInvalid".to_owned());
        }
    }
    let moved = request.story_entries.iter().find(|entry| {
        entry.resource.get("type").and_then(Value::as_str) == Some("scene")
            && entry.resource.get("id").and_then(Value::as_str) == Some(&request.scene_id)
    });
    if moved
        .and_then(|entry| entry.resource.get("chapterId"))
        .and_then(Value::as_str)
        != Some(&request.to_chapter_id)
    {
        return Err("sceneMoveTargetInvalid".to_owned());
    }
    for entry in &request.story_entries {
        if entry.resource.get("type").and_then(Value::as_str) == Some("scene")
            && entry
                .resource
                .get("chapterId")
                .and_then(Value::as_str)
                .is_none_or(|chapter| !affected.contains(chapter))
        {
            return Err("sceneMoveTargetInvalid".to_owned());
        }
    }
    for entry in &request.mention_entries {
        if entry
            .mention
            .get("chapterId")
            .and_then(Value::as_str)
            .is_none_or(|chapter| !affected.contains(chapter))
        {
            return Err("sceneMoveTargetInvalid".to_owned());
        }
    }
    Ok(())
}

fn rollback(files: &[TransactionFile], committed: usize) -> Result<(), String> {
    let mut failed = false;
    for file in files[..committed].iter().rev() {
        failed |= filesystem::write_bytes_atomic(&file.target, &file.original).is_err();
    }
    if failed {
        Err("sceneMoveRollbackFailed".to_owned())
    } else {
        Ok(())
    }
}

fn commit_files(root: &Path, files: &[TransactionFile]) -> Result<(), String> {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| "clockFailed".to_owned())?
        .as_nanos();
    let staging = root
        .join(".writing-buddy")
        .join("runtime")
        .join("scene-move-transactions")
        .join(format!("{}-{nonce}", std::process::id()));
    fs::create_dir_all(&staging).map_err(|_| "sceneMoveStagingFailed".to_owned())?;
    for (index, file) in files.iter().enumerate() {
        if filesystem::write_bytes_atomic(&staging.join(format!("{index}.stage")), &file.bytes)
            .is_err()
        {
            let _ = fs::remove_dir_all(&staging);
            return Err("sceneMoveStagingFailed".to_owned());
        }
    }

    let mut committed = 0usize;
    for file in files {
        if filesystem::write_bytes_atomic(&file.target, &file.bytes).is_err() {
            let rollback_result = rollback(files, committed);
            let _ = fs::remove_dir_all(&staging);
            return Err(rollback_result
                .err()
                .unwrap_or_else(|| "sceneMoveWriteFailed".to_owned()));
        }
        committed += 1;
    }
    let verified = files
        .iter()
        .all(|file| fs::read(&file.target).is_ok_and(|bytes| bytes == file.bytes));
    if !verified {
        let rollback_result = rollback(files, committed);
        let _ = fs::remove_dir_all(&staging);
        return Err(rollback_result
            .err()
            .unwrap_or_else(|| "sceneMoveVerificationFailed".to_owned()));
    }
    let _ = fs::remove_dir_all(&staging);
    Ok(())
}

fn prepared_files(
    texts: &[PreparedText],
    resources: &[PreparedResource],
    mentions: &[PreparedMention],
) -> Result<Vec<TransactionFile>, String> {
    let mut targets = HashSet::new();
    let mut files = Vec::with_capacity(texts.len() + resources.len() + mentions.len());
    for text in texts {
        if !targets.insert(text.target.clone()) {
            return Err("sceneMoveTargetInvalid".to_owned());
        }
        files.push(TransactionFile {
            target: text.target.clone(),
            original: text.original.clone(),
            bytes: text.bytes.clone(),
        });
    }
    for resource in resources {
        let original = resource
            .original
            .clone()
            .ok_or_else(|| "sceneMoveStoryRevisionConflict".to_owned())?;
        if !targets.insert(resource.target.clone()) {
            return Err("sceneMoveTargetInvalid".to_owned());
        }
        files.push(TransactionFile {
            target: resource.target.clone(),
            original,
            bytes: resource.bytes.clone(),
        });
    }
    for mention in mentions {
        let original = mention
            .original
            .clone()
            .ok_or_else(|| "sceneMoveMentionRevisionConflict".to_owned())?;
        if !targets.insert(mention.target.clone()) {
            return Err("sceneMoveTargetInvalid".to_owned());
        }
        files.push(TransactionFile {
            target: mention.target.clone(),
            original,
            bytes: mention.bytes.clone(),
        });
    }
    Ok(files)
}

pub(crate) fn commit_scene_move_on_disk(
    request: &SceneMoveCommitRequest,
) -> Result<SceneMoveCommitResult, String> {
    let root = filesystem::canonical_project_root(&request.project_root)?;
    let manifest_path = root.join(".writing-buddy").join("project.json");
    let manifest_bytes = fs::read(&manifest_path).map_err(|_| "manifestReadFailed".to_owned())?;
    if filesystem::sha256(&manifest_bytes) != request.expected_project_revision {
        return Err("sceneMoveProjectRevisionConflict".to_owned());
    }
    let project: migration::WritingProject =
        serde_json::from_slice(&manifest_bytes).map_err(|_| "invalidManifest".to_owned())?;
    let paths = chapter_paths(&project)?;
    validate_scope(request, &paths)?;

    let texts = request
        .manuscripts
        .iter()
        .map(|write| prepare_text(&root, &request.project_root, write))
        .collect::<Result<Vec<_>, _>>()?;
    let resources = request
        .story_entries
        .iter()
        .map(|entry| prepare_resource(&root, entry).map_err(map_prepare_error))
        .collect::<Result<Vec<_>, _>>()?;
    let mentions = request
        .mention_entries
        .iter()
        .map(|entry| prepare_mention(&root, entry).map_err(map_prepare_error))
        .collect::<Result<Vec<_>, _>>()?;
    let files = prepared_files(&texts, &resources, &mentions)?;
    commit_files(&root, &files)?;

    Ok(SceneMoveCommitResult {
        story_resources: resources
            .into_iter()
            .map(|resource| resource.value)
            .collect(),
        mentions: mentions.into_iter().map(|mention| mention.value).collect(),
        manuscripts: texts
            .into_iter()
            .map(|text| SceneMoveManuscriptResult {
                chapter_id: text.chapter_id,
                relative_path: text.relative_path,
                hash: filesystem::sha256(&text.bytes),
                byte_length: text.bytes.len(),
            })
            .collect(),
    })
}

#[tauri::command]
pub fn story_commit_scene_move(
    state: State<'_, AppState>,
    request: SceneMoveCommitRequest,
) -> Result<SceneMoveCommitResult, String> {
    require_write_lock(&state, &request.project_root)?;
    let _transaction = state
        .story_transactions
        .lock()
        .map_err(|_| "storyTransactionLockPoisoned".to_owned())?;
    let result = commit_scene_move_on_disk(&request)?;
    if invalidate_cached_index(&state, &request.project_root).is_err() {
        logging::event(
            "story.index.invalidate.failed",
            "warning",
            None,
            Some("storyIndexUpdateFailed"),
        );
    }
    logging::event("story.scene.moved", "info", None, None);
    Ok(result)
}

#[cfg(test)]
mod tests {
    use std::{
        fs,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    use serde_json::{Value, json};

    use super::{SceneMoveCommitRequest, SceneMoveTextWrite, commit_scene_move_on_disk};
    use crate::{
        filesystem,
        story::{
            mentions::MentionSaveEntry,
            storage::{self, StorySaveEntry},
        },
    };

    fn temp_project() -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "writing-buddy-scene-move-{}-{nonce}",
            std::process::id()
        ));
        fs::create_dir_all(root.join(".writing-buddy")).expect("metadata");
        fs::create_dir_all(root.join("chapters")).expect("chapters");
        let manifest = json!({
            "schemaVersion": 1,
            "projectId": "project-scene-move",
            "title": "Sanitized scene move",
            "volumes": [{
                "id": "volume-one",
                "title": "Volume",
                "chapters": [{
                    "id": "chapter-one",
                    "title": "One",
                    "file": "chapters/one.md",
                    "scene": {
                        "location": "",
                        "time": "",
                        "pov": "",
                        "characters": [],
                        "goal": "",
                        "note": ""
                    }
                }, {
                    "id": "chapter-two",
                    "title": "Two",
                    "file": "chapters/two.md",
                    "scene": {
                        "location": "",
                        "time": "",
                        "pov": "",
                        "characters": [],
                        "goal": "",
                        "note": ""
                    }
                }]
            }]
        });
        let mut manifest_bytes = serde_json::to_vec_pretty(&manifest).expect("manifest");
        manifest_bytes.push(b'\n');
        fs::write(
            root.join(".writing-buddy").join("project.json"),
            manifest_bytes,
        )
        .expect("manifest write");
        fs::write(root.join("chapters").join("one.md"), "AAA--BBB").expect("source manuscript");
        fs::write(root.join("chapters").join("two.md"), "TARGET").expect("target manuscript");
        root
    }

    fn scene(chapter_id: &str, start: u64, end: u64, quote: &str) -> Value {
        json!({
            "id": "scene:first",
            "type": "scene",
            "title": "First",
            "aliases": [],
            "tags": [],
            "schemaVersion": 1,
            "createdAt": "2026-07-28T00:00:00.000Z",
            "updatedAt": "2026-07-28T00:00:00.000Z",
            "revision": 1,
            "chapterId": chapter_id,
            "manuscriptRange": {
                "start": start,
                "end": end,
                "revision": 2,
                "quote": quote
            },
            "narrativeOrder": 0,
            "locationIds": [],
            "participantIds": [],
            "plotThreadIds": [],
            "revealInformationIds": [],
            "foreshadowingIds": [],
            "evidenceIds": []
        })
    }

    fn mention(chapter_id: &str, start: u64, end: u64, quote: &str) -> Value {
        json!({
            "id": "mention:first",
            "resourceId": "character:lin",
            "chapterId": chapter_id,
            "sceneId": "scene:first",
            "anchor": {
                "start": start,
                "end": end,
                "revision": 2,
                "quote": quote,
                "before": "",
                "after": ""
            },
            "displayText": quote,
            "status": "active",
            "revision": 1,
            "createdAt": "2026-07-28T00:00:00.000Z",
            "updatedAt": "2026-07-28T00:00:00.000Z"
        })
    }

    fn seed_story(root: &PathBuf) {
        storage::save_resources(
            &root.to_string_lossy(),
            &[StorySaveEntry {
                resource: {
                    let mut value = scene("chapter:chapter-one", 0, 3, "AAA");
                    value["revision"] = Value::from(0);
                    value
                },
                expected_revision: Some(0),
                expected_absent: false,
            }],
        )
        .expect("seed scene");
        crate::story::mentions::save_links(
            &root.to_string_lossy(),
            &[MentionSaveEntry {
                mention: {
                    let mut value = mention("chapter:chapter-one", 0, 3, "AAA");
                    value["revision"] = Value::from(0);
                    value
                },
                expected_revision: Some(0),
            }],
        )
        .expect("seed mention");
    }

    fn request(root: &PathBuf) -> SceneMoveCommitRequest {
        let manifest =
            fs::read(root.join(".writing-buddy").join("project.json")).expect("manifest");
        let source = fs::read(root.join("chapters").join("one.md")).expect("source");
        let target = fs::read(root.join("chapters").join("two.md")).expect("target");
        SceneMoveCommitRequest {
            project_root: root.to_string_lossy().into_owned(),
            command_id: "move:first".to_owned(),
            scene_id: "scene:first".to_owned(),
            from_chapter_id: "chapter:chapter-one".to_owned(),
            to_chapter_id: "chapter:chapter-two".to_owned(),
            expected_project_revision: filesystem::sha256(&manifest),
            manuscripts: vec![
                SceneMoveTextWrite {
                    chapter_id: "chapter:chapter-one".to_owned(),
                    relative_path: "chapters/one.md".to_owned(),
                    content: "--BBB".to_owned(),
                    expected_hash: filesystem::sha256(&source),
                    eol: "lf".to_owned(),
                    has_bom: false,
                },
                SceneMoveTextWrite {
                    chapter_id: "chapter:chapter-two".to_owned(),
                    relative_path: "chapters/two.md".to_owned(),
                    content: "TARGETAAA".to_owned(),
                    expected_hash: filesystem::sha256(&target),
                    eol: "lf".to_owned(),
                    has_bom: false,
                },
            ],
            story_entries: vec![StorySaveEntry {
                resource: scene("chapter:chapter-two", 6, 9, "AAA"),
                expected_revision: Some(1),
                expected_absent: false,
            }],
            mention_entries: vec![MentionSaveEntry {
                mention: mention("chapter:chapter-two", 6, 9, "AAA"),
                expected_revision: Some(1),
            }],
        }
    }

    #[test]
    fn commits_manuscripts_story_and_mentions_in_one_verified_transaction() {
        let root = temp_project();
        seed_story(&root);
        let result = commit_scene_move_on_disk(&request(&root)).expect("commit scene move");

        assert_eq!(
            fs::read_to_string(root.join("chapters").join("one.md")).expect("source"),
            "--BBB"
        );
        assert_eq!(
            fs::read_to_string(root.join("chapters").join("two.md")).expect("target"),
            "TARGETAAA"
        );
        assert_eq!(result.story_resources[0]["revision"], 2);
        assert_eq!(
            result.story_resources[0]["chapterId"],
            "chapter:chapter-two"
        );
        assert_eq!(result.mentions[0]["revision"], 2);
        assert_eq!(result.manuscripts.len(), 2);

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn rejects_a_stale_manuscript_before_writing_any_target() {
        let root = temp_project();
        seed_story(&root);
        let mut move_request = request(&root);
        move_request.manuscripts[0].expected_hash = "stale".to_owned();
        let error = commit_scene_move_on_disk(&move_request).expect_err("stale text");
        assert_eq!(error, "sceneMoveTextConflict");
        assert_eq!(
            fs::read_to_string(root.join("chapters").join("one.md")).expect("source"),
            "AAA--BBB"
        );
        let stored = storage::get_resource(&root.to_string_lossy(), "scene", "scene:first")
            .expect("read")
            .expect("scene");
        assert_eq!(stored["revision"], 1);
        assert_eq!(stored["chapterId"], "chapter:chapter-one");

        let _ = fs::remove_dir_all(root);
    }
}
