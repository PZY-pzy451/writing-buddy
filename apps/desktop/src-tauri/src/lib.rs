mod ai;
mod archive;
mod commands;
mod filesystem;
mod logging;
mod migration;
mod process_lock;
mod secrets;

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
    ai_jobs: Mutex<ai::job_registry::AiJobRegistry>,
}

pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::choose_project,
            commands::open_project,
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
