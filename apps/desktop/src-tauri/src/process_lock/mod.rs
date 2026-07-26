use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::PathBuf,
    process::Command,
};

use chrono::Utc;
use serde::{Deserialize, Serialize};

use crate::{AppState, filesystem};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LockFile {
    application: String,
    version: String,
    pid: u32,
    started_at: String,
    mode: String,
}

fn process_exists(pid: u32) -> bool {
    #[cfg(windows)]
    {
        let filter = format!("PID eq {pid}");
        return Command::new("tasklist")
            .args(["/FI", &filter, "/NH"])
            .output()
            .map(|output| String::from_utf8_lossy(&output.stdout).contains(&pid.to_string()))
            .unwrap_or(true);
    }
    #[cfg(not(windows))]
    {
        Path::new(&format!("/proc/{pid}")).exists()
    }
}

pub fn acquire(state: &AppState, project_root: &str) -> Result<PathBuf, String> {
    let root = filesystem::canonical_project_root(project_root)?;
    if let Some(existing) = state
        .locks
        .lock()
        .map_err(|_| "lockPoisoned".to_owned())?
        .get(&root)
    {
        return Ok(existing.clone());
    }
    let runtime = root.join(".writing-buddy").join("runtime");
    fs::create_dir_all(&runtime).map_err(|_| "lockCreateFailed".to_owned())?;
    let path = runtime.join("project.lock");
    if path.exists() {
        let existing = fs::read_to_string(&path)
            .ok()
            .and_then(|value| serde_json::from_str::<LockFile>(&value).ok());
        if let Some(existing) = existing {
            if existing.pid != std::process::id() && process_exists(existing.pid) {
                return Err(format!("projectLocked:{}", existing.pid));
            }
        }
        fs::remove_file(&path).map_err(|_| "staleLockRemoveFailed".to_owned())?;
    }
    let lock = LockFile {
        application: "writing-buddy-next".to_owned(),
        version: env!("CARGO_PKG_VERSION").to_owned(),
        pid: std::process::id(),
        started_at: Utc::now().to_rfc3339(),
        mode: "read-write".to_owned(),
    };
    let bytes = serde_json::to_vec_pretty(&lock).map_err(|_| "lockSerializeFailed".to_owned())?;
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&path)
        .map_err(|_| "projectLocked".to_owned())?;
    file.write_all(&bytes)
        .map_err(|_| "lockWriteFailed".to_owned())?;
    file.sync_all().map_err(|_| "lockSyncFailed".to_owned())?;
    state
        .locks
        .lock()
        .map_err(|_| "lockPoisoned".to_owned())?
        .insert(root, path.clone());
    Ok(path)
}

pub fn release_all(state: &AppState) {
    if let Ok(mut locks) = state.locks.lock() {
        for path in locks.values() {
            if let Ok(value) = fs::read_to_string(path) {
                if let Ok(lock) = serde_json::from_str::<LockFile>(&value) {
                    if lock.pid == std::process::id() {
                        let _ = fs::remove_file(path);
                    }
                }
            }
        }
        locks.clear();
    }
}
