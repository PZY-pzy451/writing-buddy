use serde_json::Value;
use tauri::State;

use crate::{AppState, commands::require_write_lock, logging};

use super::storage::{self, StorySaveEntry};

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
    logging::event("story.content.changed", "info", None, None);
    Ok(restored)
}
