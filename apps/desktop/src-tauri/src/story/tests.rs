use std::{
    fs,
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};

use serde_json::{Value, json};

use super::mentions::{self, MentionSaveEntry};
use super::storage::{self, StorySaveEntry};

fn temp_project() -> PathBuf {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("clock")
        .as_nanos();
    let root = std::env::temp_dir().join(format!(
        "writing-buddy-story-storage-{}-{nonce}",
        std::process::id()
    ));
    fs::create_dir_all(root.join(".writing-buddy").join("runtime")).expect("create project");
    root
}

fn character(id: &str) -> Value {
    json!({
        "id": id,
        "type": "character",
        "title": "林越",
        "aliases": [],
        "tags": [],
        "schemaVersion": 1,
        "createdAt": "2026-07-27T00:00:00.000Z",
        "updatedAt": "2026-07-27T00:00:00.000Z",
        "revision": 0,
        "evidenceIds": []
    })
}

fn mention(id: &str) -> Value {
    json!({
        "id": id,
        "resourceId": "character:lin-yue",
        "chapterId": "chapter:chapter-001",
        "anchor": {
            "start": 2,
            "end": 4,
            "revision": 0,
            "quote": "林越",
            "before": "夜里",
            "after": "走进车站"
        },
        "displayText": "林越",
        "status": "active",
        "revision": 0,
        "createdAt": "2026-07-27T00:00:00.000Z",
        "updatedAt": "2026-07-27T00:00:00.000Z"
    })
}

#[test]
fn saves_atomically_and_rejects_stale_revisions() {
    let root = temp_project();
    let entry = StorySaveEntry {
        resource: character("character:lin-yue"),
        expected_revision: Some(0),
    };
    let saved =
        storage::save_resources(&root.to_string_lossy(), &[entry.clone()]).expect("initial save");
    assert_eq!(saved[0]["revision"], 1);

    let error = storage::save_resources(&root.to_string_lossy(), &[entry]).expect_err("stale save");
    assert_eq!(error, "storyRevisionConflict:1");
    let stored = storage::get_resource(&root.to_string_lossy(), "character", "character:lin-yue")
        .expect("read")
        .expect("resource");
    assert_eq!(stored["revision"], 1);

    let _ = fs::remove_dir_all(root);
}

#[test]
fn rejects_invalid_schema_before_creating_any_story_file() {
    let root = temp_project();
    let mut invalid = character("character:invalid");
    invalid["schemaVersion"] = Value::from(2);
    let error = storage::save_resources(
        &root.to_string_lossy(),
        &[StorySaveEntry {
            resource: invalid,
            expected_revision: Some(0),
        }],
    )
    .expect_err("invalid schema");
    assert_eq!(error, "unsupportedStorySchema");
    assert!(!root.join("story").exists());

    let _ = fs::remove_dir_all(root);
}

#[test]
fn validates_every_entry_before_partial_staging() {
    let root = temp_project();
    let mut invalid = character("character:shen-qing");
    invalid["revision"] = Value::from(-1);
    let error = storage::save_resources(
        &root.to_string_lossy(),
        &[
            StorySaveEntry {
                resource: character("character:lin-yue"),
                expected_revision: Some(0),
            },
            StorySaveEntry {
                resource: invalid,
                expected_revision: Some(0),
            },
        ],
    )
    .expect_err("invalid batch");
    assert_eq!(error, "invalidStoryRevision");
    assert!(
        storage::list_resources(&root.to_string_lossy(), "character")
            .expect("list")
            .is_empty()
    );

    let _ = fs::remove_dir_all(root);
}

#[test]
fn moves_to_trash_and_restores_without_data_loss() {
    let root = temp_project();
    let saved = storage::save_resources(
        &root.to_string_lossy(),
        &[StorySaveEntry {
            resource: character("character:lin-yue"),
            expected_revision: Some(0),
        }],
    )
    .expect("save");
    storage::move_to_trash(&root.to_string_lossy(), "character", "character:lin-yue")
        .expect("trash");
    assert!(
        storage::get_resource(&root.to_string_lossy(), "character", "character:lin-yue")
            .expect("get")
            .is_none()
    );
    let restored =
        storage::restore_from_trash(&root.to_string_lossy(), "character", "character:lin-yue")
            .expect("restore");
    assert_eq!(restored, saved[0]);

    let _ = fs::remove_dir_all(root);
}

#[test]
fn saves_mentions_outside_markdown_with_revision_checks() {
    let root = temp_project();
    let entry = MentionSaveEntry {
        mention: mention("mention:lin-yue-intro"),
        expected_revision: Some(0),
    };
    let saved =
        mentions::save_links(&root.to_string_lossy(), &[entry.clone()]).expect("save mention");
    assert_eq!(saved[0]["revision"], 1);
    assert_eq!(
        mentions::list_links(&root.to_string_lossy())
            .expect("list mentions")
            .len(),
        1
    );
    assert!(!root.join("chapters").join("chapter-001.md").exists());

    let error = mentions::save_links(&root.to_string_lossy(), &[entry]).expect_err("stale mention");
    assert_eq!(error, "mentionRevisionConflict:1");
    let _ = fs::remove_dir_all(root);
}

#[test]
fn validates_all_mentions_before_creating_the_author_owned_directory() {
    let root = temp_project();
    let mut invalid = mention("mention:broken");
    invalid["anchor"]["end"] = Value::from(2);
    let error = mentions::save_links(
        &root.to_string_lossy(),
        &[
            MentionSaveEntry {
                mention: mention("mention:valid"),
                expected_revision: Some(0),
            },
            MentionSaveEntry {
                mention: invalid,
                expected_revision: Some(0),
            },
        ],
    )
    .expect_err("invalid batch");
    assert_eq!(error, "invalidMention");
    assert!(!root.join("story").join("mentions").exists());
    let _ = fs::remove_dir_all(root);
}
