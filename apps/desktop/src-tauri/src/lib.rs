mod ai;
mod archive;
mod commands;
mod filesystem;
mod logging;
mod migration;
mod process_lock;
mod secrets;
mod story;

use std::{
    collections::{HashMap, HashSet},
    path::PathBuf,
    sync::Mutex,
};
use tauri::Manager;

#[derive(Default)]
pub struct AppState {
    locks: Mutex<HashMap<PathBuf, PathBuf>>,
    approved_backups: Mutex<HashSet<PathBuf>>,
    story_transactions: Mutex<()>,
    ai_jobs: Mutex<ai::job_registry::AiJobRegistry>,
}

pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::choose_project,
            commands::open_project,
            commands::repair_project,
            commands::reveal_project_directory,
            story::commands::story_get_resource,
            story::commands::story_list_resources,
            story::commands::story_save_resources,
            story::commands::story_move_to_trash,
            story::commands::story_restore_from_trash,
            story::mentions::mention_list_links,
            story::mentions::mention_save_links,
            commands::read_text,
            commands::write_text_atomic,
            commands::save_text_as,
            commands::read_resource,
            commands::write_resource,
            commands::read_review_state,
            commands::write_review_state,
            commands::create_snapshot,
            commands::list_versions,
            commands::read_version_text,
            commands::restore_version,
            commands::create_backup,
            commands::choose_backup,
            commands::inspect_backup,
            commands::restore_backup,
            ai::commands::ai_get_provider_status,
            ai::commands::ai_save_deepseek_key,
            ai::commands::ai_delete_deepseek_key,
            ai::commands::ai_test_deepseek_connection,
            ai::commands::ai_list_deepseek_models,
            ai::commands::ai_get_deepseek_balance,
            ai::commands::ai_get_preferences,
            ai::commands::ai_save_preferences,
            ai::commands::ai_start_generation,
            ai::commands::ai_cancel_job,
            ai::commands::ai_get_usage_summary,
        ])
        .build(tauri::generate_context!())
        .expect("Writing Buddy failed to initialize")
        .run(|app, event| {
            if matches!(
                event,
                tauri::RunEvent::Exit | tauri::RunEvent::ExitRequested { .. }
            ) {
                if let Some(state) = app.try_state::<AppState>() {
                    process_lock::release_all(&state);
                    if let Ok(mut jobs) = state.ai_jobs.lock() {
                        jobs.cancel_all();
                    }
                }
            }
        });
}

#[cfg(test)]
mod capability_tests {
    #[test]
    fn main_window_can_destroy_itself_after_close_listener_allows_exit() {
        let capability: serde_json::Value =
            serde_json::from_str(include_str!("../capabilities/default.json"))
                .expect("default capability must be valid JSON");
        let permissions = capability["permissions"]
            .as_array()
            .expect("default capability permissions");

        assert!(
            permissions
                .iter()
                .any(|permission| permission == "core:window:allow-destroy"),
            "onCloseRequested calls window.destroy(), so the main window needs allow-destroy"
        );
    }
}
