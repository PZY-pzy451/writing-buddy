use serde_json::Value;
use tauri::State;

use crate::{AppState, commands::require_write_lock, filesystem, logging};

use super::{
    index::{
        self, IndexMutation, IndexQuery, IndexQueryResult, StoryIndexStats, index_record_from_value,
    },
    storage::{self, StorySaveEntry},
};

pub(crate) fn update_cached_index(
    state: &AppState,
    project_root: &str,
    mutations: &[IndexMutation],
) -> Result<(), String> {
    let root = filesystem::canonical_project_root(project_root)?;
    let mut indexes = state
        .story_indexes
        .lock()
        .map_err(|_| "storyIndexLockPoisoned".to_owned())?;
    let Some(story_index) = indexes.get_mut(&root) else {
        return Ok(());
    };
    story_index.apply(mutations);
    index::persist_project_index(&root, story_index)
}

pub(crate) fn invalidate_cached_index(state: &AppState, project_root: &str) -> Result<(), String> {
    let root = filesystem::canonical_project_root(project_root)?;
    state
        .story_indexes
        .lock()
        .map_err(|_| "storyIndexLockPoisoned".to_owned())?
        .remove(&root);
    index::remove_project_index(&root)
}

#[tauri::command]
pub fn story_get_resource(
    project_root: String,
    resource_type: String,
    id: String,
) -> Result<Option<Value>, String> {
    storage::get_resource(&project_root, &resource_type, &id)
}

#[tauri::command]
pub fn story_list_resources(
    project_root: String,
    resource_type: String,
) -> Result<Vec<Value>, String> {
    storage::list_resources(&project_root, &resource_type)
}

#[tauri::command]
pub fn story_save_resources(
    state: State<'_, AppState>,
    project_root: String,
    entries: Vec<StorySaveEntry>,
) -> Result<Vec<Value>, String> {
    require_write_lock(&state, &project_root)?;
    let _transaction = state
        .story_transactions
        .lock()
        .map_err(|_| "storyTransactionLockPoisoned".to_owned())?;
    let saved = storage::save_resources(&project_root, &entries)?;
    let mutations = saved
        .iter()
        .filter_map(|value| index_record_from_value(value, "resource"))
        .map(IndexMutation::Upsert)
        .collect::<Vec<_>>();
    if update_cached_index(&state, &project_root, &mutations).is_err() {
        logging::event(
            "story.index.incremental.failed",
            "warning",
            None,
            Some("storyIndexUpdateFailed"),
        );
    }
    logging::event("story.content.changed", "info", None, None);
    Ok(saved)
}

#[tauri::command]
pub fn story_move_to_trash(
    state: State<'_, AppState>,
    project_root: String,
    resource_type: String,
    id: String,
) -> Result<(), String> {
    require_write_lock(&state, &project_root)?;
    let _transaction = state
        .story_transactions
        .lock()
        .map_err(|_| "storyTransactionLockPoisoned".to_owned())?;
    storage::move_to_trash(&project_root, &resource_type, &id)?;
    if update_cached_index(&state, &project_root, &[IndexMutation::Remove(id.clone())]).is_err() {
        logging::event(
            "story.index.incremental.failed",
            "warning",
            None,
            Some("storyIndexUpdateFailed"),
        );
    }
    logging::event("story.content.changed", "info", None, None);
    Ok(())
}

#[tauri::command]
pub fn story_restore_from_trash(
    state: State<'_, AppState>,
    project_root: String,
    resource_type: String,
    id: String,
) -> Result<Value, String> {
    require_write_lock(&state, &project_root)?;
    let _transaction = state
        .story_transactions
        .lock()
        .map_err(|_| "storyTransactionLockPoisoned".to_owned())?;
    let restored = storage::restore_from_trash(&project_root, &resource_type, &id)?;
    if let Some(record) = index_record_from_value(&restored, "resource")
        && update_cached_index(&state, &project_root, &[IndexMutation::Upsert(record)]).is_err()
    {
        logging::event(
            "story.index.incremental.failed",
            "warning",
            None,
            Some("storyIndexUpdateFailed"),
        );
    }
    logging::event("story.content.changed", "info", None, None);
    Ok(restored)
}

#[tauri::command]
pub fn story_index_status(
    state: State<'_, AppState>,
    project_root: String,
) -> Result<StoryIndexStats, String> {
    let root = filesystem::canonical_project_root(&project_root)?;
    {
        let indexes = state
            .story_indexes
            .lock()
            .map_err(|_| "storyIndexLockPoisoned".to_owned())?;
        if let Some(story_index) = indexes.get(&root) {
            return Ok(story_index.stats());
        }
    }
    match index::load_project_index(&project_root) {
        Ok((root, story_index)) => {
            let stats = story_index.stats();
            state
                .story_indexes
                .lock()
                .map_err(|_| "storyIndexLockPoisoned".to_owned())?
                .insert(root, story_index);
            Ok(stats)
        }
        Err(error) if error == "storyIndexNotFound" => Ok(StoryIndexStats {
            schema_version: index::STORY_INDEX_SCHEMA_VERSION,
            ready: false,
            source_fingerprint: String::new(),
            record_count: 0,
            kind_counts: Default::default(),
        }),
        Err(error) => Err(error),
    }
}

#[tauri::command]
pub fn story_rebuild_index(
    state: State<'_, AppState>,
    project_root: String,
) -> Result<StoryIndexStats, String> {
    require_write_lock(&state, &project_root)?;
    let (root, story_index) = index::rebuild_project_index(&project_root)?;
    index::persist_project_index(&root, &story_index)?;
    let stats = story_index.stats();
    state
        .story_indexes
        .lock()
        .map_err(|_| "storyIndexLockPoisoned".to_owned())?
        .insert(root, story_index);
    logging::event("story.index.rebuilt", "info", None, None);
    Ok(stats)
}

#[tauri::command]
pub fn story_query_index(
    state: State<'_, AppState>,
    project_root: String,
    query: IndexQuery,
) -> Result<IndexQueryResult, String> {
    let root = filesystem::canonical_project_root(&project_root)?;
    {
        let indexes = state
            .story_indexes
            .lock()
            .map_err(|_| "storyIndexLockPoisoned".to_owned())?;
        if let Some(story_index) = indexes.get(&root) {
            return Ok(story_index.query(&query));
        }
    }
    let (root, story_index) = index::load_project_index(&project_root)?;
    let result = story_index.query(&query);
    state
        .story_indexes
        .lock()
        .map_err(|_| "storyIndexLockPoisoned".to_owned())?
        .insert(root, story_index);
    Ok(result)
}
