use std::{
    collections::BTreeSet,
    fs,
    path::{Path, PathBuf},
    process::Command,
    sync::atomic::{AtomicU64, Ordering},
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
    process_lock,
};

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

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ProjectOpenMode {
    ReadWrite,
    ReadOnly,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicProjectOpenError {
    code: String,
    stage: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    safe_path: Option<String>,
    can_open_read_only: bool,
    can_repair: bool,
    diagnostic_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectRepairResult {
    repaired: bool,
    diagnostic_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectRequest {
    name: String,
    #[serde(default)]
    description: String,
    root_directory: String,
    project_type: String,
    language: String,
    template_id: String,
    selected_initial_resources: Vec<String>,
    theme_id: String,
    accent_id: String,
    writing_mode: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectCreationIssue {
    field: &'static str,
    code: &'static str,
    message: &'static str,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectCreationPreflight {
    valid: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    target_root: Option<String>,
    created_file_count: usize,
    created_directory_count: usize,
    issues: Vec<ProjectCreationIssue>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatedProject {
    root: String,
    project_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    first_chapter_id: Option<String>,
    created_file_count: usize,
    created_directory_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OrderedLocation {
    container_id: String,
    index: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveCommand {
    command_id: String,
    entity_type: String,
    entity_ids: Vec<String>,
    from: OrderedLocation,
    to: OrderedLocation,
    expected_project_revision: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectStructureMoveRequest {
    project_root: String,
    command: MoveCommand,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectStructureMoveResult {
    project: migration::WritingProject,
    project_revision: String,
    inverse_command: MoveCommand,
    description: String,
}

static DIAGNOSTIC_SEQUENCE: AtomicU64 = AtomicU64::new(1);

fn project_diagnostic_id(code: &str) -> String {
    let sequence = DIAGNOSTIC_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    let seed = format!(
        "{}:{code}:{sequence}:{}",
        Utc::now().timestamp_millis(),
        std::process::id()
    );
    let digest = hex::encode(Sha256::digest(seed.as_bytes()));
    format!("project-open-{}", &digest[..16])
}

fn safe_project_path(project_root: &str) -> Option<String> {
    if project_root.trim().is_empty() {
        return None;
    }
    let separator = if project_root.contains('\\') {
        '\\'
    } else {
        '/'
    };
    let mut segments = project_root
        .split(['\\', '/'])
        .map(ToOwned::to_owned)
        .collect::<Vec<_>>();
    if let Some(users_index) = segments
        .iter()
        .position(|segment| segment.eq_ignore_ascii_case("users"))
    {
        if let Some(username) = segments.get_mut(users_index + 1) {
            *username = "***".to_owned();
        }
    }
    Some(segments.join(&separator.to_string()))
}

fn public_project_open_error(code: &str, project_root: &str) -> PublicProjectOpenError {
    let public_code = code.split(':').next().unwrap_or("projectOpenFailed");
    let stage = match public_code {
        "projectRootUnavailable" => "select-path",
        "manifestNotFound" | "manifestReadFailed" | "invalidManifest" => "read-manifest",
        "unsupportedSchema" => "validate-schema",
        "projectLocked"
        | "lockPoisoned"
        | "lockCreateFailed"
        | "lockSerializeFailed"
        | "staleLockRemoveFailed"
        | "lockWriteFailed"
        | "lockSyncFailed" => "acquire-lock",
        "projectReadFailed" | "missingChapterFile" | "unsafePath" => "integrity-scan",
        _ => "load-index",
    };
    let can_open_read_only = matches!(
        public_code,
        "projectLocked"
            | "lockPoisoned"
            | "lockCreateFailed"
            | "lockSerializeFailed"
            | "staleLockRemoveFailed"
            | "lockWriteFailed"
            | "lockSyncFailed"
    );
    let can_repair = matches!(public_code, "staleLockRemoveFailed");
    PublicProjectOpenError {
        code: public_code.to_owned(),
        stage,
        safe_path: safe_project_path(project_root),
        can_open_read_only,
        can_repair,
        diagnostic_id: project_diagnostic_id(public_code),
    }
}

pub(crate) fn require_write_lock(state: &AppState, project_root: &str) -> Result<(), String> {
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
pub fn choose_project_parent_directory() -> Option<String> {
    rfd::FileDialog::new()
        .set_title("选择新作品保存位置")
        .pick_folder()
        .map(|path| path.to_string_lossy().into_owned())
}

fn creation_issue(
    field: &'static str,
    code: &'static str,
    message: &'static str,
) -> ProjectCreationIssue {
    ProjectCreationIssue {
        field,
        code,
        message,
    }
}

fn valid_project_name(name: &str) -> Result<(), ProjectCreationIssue> {
    let trimmed = name.trim();
    if trimmed.is_empty() || trimmed.chars().count() > 80 {
        return Err(creation_issue(
            "name",
            "invalidProjectNameLength",
            "作品名称需要为 1–80 个字符。",
        ));
    }
    if trimmed.ends_with(' ')
        || trimmed.ends_with('.')
        || trimmed.chars().any(|character| {
            matches!(
                character,
                '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*'
            )
        })
    {
        return Err(creation_issue(
            "name",
            "invalidProjectNameCharacters",
            "作品名称包含 Windows 不允许的字符或结尾。",
        ));
    }
    let stem = trimmed
        .split('.')
        .next()
        .unwrap_or_default()
        .to_ascii_lowercase();
    let reserved = matches!(stem.as_str(), "con" | "prn" | "aux" | "nul")
        || (stem.len() == 4
            && (stem.starts_with("com") || stem.starts_with("lpt"))
            && stem
                .chars()
                .last()
                .is_some_and(|character| ('1'..='9').contains(&character)));
    if reserved {
        return Err(creation_issue(
            "name",
            "reservedProjectName",
            "该名称是 Windows 保留名称，请更换作品名称。",
        ));
    }
    Ok(())
}

fn creation_directories(request: &CreateProjectRequest) -> BTreeSet<&'static str> {
    let selected = request
        .selected_initial_resources
        .iter()
        .map(String::as_str)
        .collect::<BTreeSet<_>>();
    let mut directories = BTreeSet::from(["", ".writing-buddy"]);
    if selected.contains("first-chapter") {
        directories.insert("chapters");
    }
    if selected.contains("character-category") {
        directories.insert("references");
        directories.insert("references/characters");
    }
    if selected.contains("worldbuilding-category") {
        directories.insert("references");
        directories.insert("references/worldbuilding");
    }
    if selected.contains("timeline") {
        directories.insert("story");
        directories.insert("story/events");
    }
    if selected.contains("plot-and-foreshadowing") {
        directories.insert("story");
        directories.insert("story/plot-threads");
        directories.insert("story/foreshadowing");
    }
    if selected.contains("sample-content") {
        directories.insert("references");
        directories.insert("references/notes");
    }
    if selected.contains("ai-quick-actions") {
        directories.insert(".writing-buddy/ai");
    }
    directories
}

fn creation_file_count(request: &CreateProjectRequest) -> usize {
    2 + usize::from(
        request
            .selected_initial_resources
            .iter()
            .any(|value| value == "first-chapter"),
    ) + usize::from(
        request
            .selected_initial_resources
            .iter()
            .any(|value| value == "sample-content"),
    )
}

#[tauri::command]
pub fn preflight_project_creation(request: CreateProjectRequest) -> ProjectCreationPreflight {
    let mut issues = Vec::new();
    if let Err(issue) = valid_project_name(&request.name) {
        issues.push(issue);
    }
    if !matches!(
        request.template_id.as_str(),
        "blank-longform"
            | "mystery-longform"
            | "fantasy-longform"
            | "science-fiction-longform"
            | "realist-fiction"
            | "custom"
    ) {
        issues.push(creation_issue(
            "templateId",
            "unknownProjectTemplate",
            "所选项目模板不可用。",
        ));
    }
    if !matches!(
        request.project_type.as_str(),
        "longform" | "novella" | "short" | "series"
    ) || request.language.trim().is_empty()
        || !matches!(
            request.theme_id.as_str(),
            "paper" | "midnight" | "fog" | "focus"
        )
        || !matches!(request.accent_id.as_str(), "gold" | "blue" | "purple")
        || !matches!(
            request.writing_mode.as_str(),
            "manuscriptFirst" | "planningFirst"
        )
    {
        issues.push(creation_issue(
            "request",
            "invalidProjectCreationOption",
            "项目类型、语言或外观选项无效。",
        ));
    }
    let allowed_resources = [
        "first-volume",
        "first-chapter",
        "character-category",
        "worldbuilding-category",
        "timeline",
        "plot-and-foreshadowing",
        "sample-content",
        "ai-quick-actions",
    ];
    let selected = request
        .selected_initial_resources
        .iter()
        .map(String::as_str)
        .collect::<BTreeSet<_>>();
    if selected.len() != request.selected_initial_resources.len()
        || selected
            .iter()
            .any(|value| !allowed_resources.contains(value))
    {
        issues.push(creation_issue(
            "selectedInitialResources",
            "invalidInitialResources",
            "初始结构包含重复或未知项目。",
        ));
    }
    if selected.contains("first-chapter") && !selected.contains("first-volume") {
        issues.push(creation_issue(
            "selectedInitialResources",
            "firstChapterRequiresVolume",
            "创建第一章草稿时必须同时创建第一卷。",
        ));
    }

    let parent = match filesystem::canonical_project_root(&request.root_directory) {
        Ok(parent) => Some(parent),
        Err(_) => {
            issues.push(creation_issue(
                "rootDirectory",
                "projectParentUnavailable",
                "保存位置不存在、不是目录或当前不可访问。",
            ));
            None
        }
    };
    let target = parent
        .as_ref()
        .map(|parent| parent.join(request.name.trim()));
    if let Some(parent) = &parent {
        if fs::metadata(parent).is_ok_and(|metadata| metadata.permissions().readonly()) {
            issues.push(creation_issue(
                "rootDirectory",
                "projectParentReadOnly",
                "保存位置为只读，无法创建作品。",
            ));
        }
    }
    if let Some(target) = &target {
        if target.exists() {
            issues.push(creation_issue(
                "rootDirectory",
                "projectTargetExists",
                "同名作品目录已经存在，不会自动覆盖。",
            ));
        }
        if target.to_string_lossy().chars().count() > 240 {
            issues.push(creation_issue(
                "rootDirectory",
                "projectPathTooLong",
                "目标路径过长，请选择更短的保存位置或名称。",
            ));
        }
    }

    ProjectCreationPreflight {
        valid: issues.is_empty(),
        target_root: target.map(|path| path.to_string_lossy().into_owned()),
        created_file_count: creation_file_count(&request),
        created_directory_count: creation_directories(&request).len(),
        issues,
    }
}

fn write_pretty_json(path: &Path, value: &serde_json::Value) -> Result<(), String> {
    let mut bytes =
        serde_json::to_vec_pretty(value).map_err(|_| "projectCreateSerializeFailed".to_owned())?;
    bytes.push(b'\n');
    filesystem::write_bytes_atomic(path, &bytes)
}

fn creation_id(prefix: &str, seed: &str) -> String {
    let digest = hex::encode(Sha256::digest(seed.as_bytes()));
    format!("{prefix}-{}", &digest[..8])
}

fn create_project_in_staging(
    request: &CreateProjectRequest,
    staging: &Path,
) -> Result<(String, Option<String>), String> {
    let selected = request
        .selected_initial_resources
        .iter()
        .map(String::as_str)
        .collect::<BTreeSet<_>>();
    for relative in creation_directories(request) {
        let directory = if relative.is_empty() {
            staging.to_path_buf()
        } else {
            staging.join(relative)
        };
        fs::create_dir_all(directory).map_err(|_| "projectStagingWriteFailed".to_owned())?;
    }

    let nonce = format!(
        "{}:{}:{}",
        request.name,
        Utc::now().timestamp_millis(),
        std::process::id()
    );
    let project_id = creation_id("project", &nonce);
    let volume_id = creation_id("volume", &format!("{nonce}:volume"));
    let first_chapter_id = selected
        .contains("first-chapter")
        .then(|| creation_id("chapter", &format!("{nonce}:chapter")));
    let chapters = first_chapter_id
        .as_ref()
        .map(|chapter_id| {
            vec![json!({
                "id": chapter_id,
                "title": "第一章",
                "file": "chapters/chapter-001.md",
                "status": "draft",
                "scene": {
                    "location": "",
                    "time": "",
                    "pov": "",
                    "characters": [],
                    "goal": "",
                    "note": ""
                }
            })]
        })
        .unwrap_or_default();
    let volumes = if selected.contains("first-volume") {
        vec![json!({
            "id": volume_id,
            "title": "第一卷",
            "chapters": chapters
        })]
    } else {
        Vec::new()
    };
    write_pretty_json(
        &staging.join(".writing-buddy").join("project.json"),
        &json!({
            "schemaVersion": 1,
            "projectId": project_id,
            "title": request.name.trim(),
            "volumes": volumes
        }),
    )?;
    write_pretty_json(
        &staging.join(".writing-buddy").join("workspace.json"),
        &json!({
            "schemaVersion": 1,
            "description": request.description.trim(),
            "projectType": request.project_type,
            "language": request.language,
            "templateId": request.template_id,
            "selectedInitialResources": request.selected_initial_resources,
            "themeId": request.theme_id,
            "accentId": request.accent_id,
            "writingMode": request.writing_mode,
            "aiQuickActionsEnabled": selected.contains("ai-quick-actions"),
            "createdAt": Utc::now().to_rfc3339()
        }),
    )?;
    if first_chapter_id.is_some() {
        filesystem::write_bytes_atomic(
            &staging.join("chapters").join("chapter-001.md"),
            "# 第一章\n\n".as_bytes(),
        )?;
    }
    if selected.contains("sample-content") {
        filesystem::write_bytes_atomic(
            &staging.join("references").join("notes").join("开始创作.md"),
            "# 开始创作\n\n这里保存创作提示与备忘，不包含自动生成的小说正文。\n".as_bytes(),
        )?;
    }
    Ok((project_id, first_chapter_id))
}

#[tauri::command]
pub fn create_project(request: CreateProjectRequest) -> Result<CreatedProject, String> {
    let preflight = preflight_project_creation(request.clone());
    if !preflight.valid {
        let code = preflight
            .issues
            .first()
            .map(|issue| issue.code)
            .unwrap_or("projectCreationPreflightFailed");
        return Err(code.to_owned());
    }
    let target = PathBuf::from(
        preflight
            .target_root
            .as_deref()
            .ok_or_else(|| "projectCreationPreflightFailed".to_owned())?,
    );
    let parent = target
        .parent()
        .ok_or_else(|| "projectParentUnavailable".to_owned())?;
    let staging = parent.join(format!(
        ".writing-buddy-project-staging-{}-{}",
        std::process::id(),
        Utc::now().timestamp_millis()
    ));
    fs::create_dir(&staging).map_err(|_| "projectStagingCreateFailed".to_owned())?;
    let result = (|| -> Result<CreatedProject, String> {
        let (project_id, first_chapter_id) = create_project_in_staging(&request, &staging)?;
        let verified = migration::open_project(&staging.to_string_lossy())
            .map_err(|_| "projectStagingVerifyFailed".to_owned())?;
        if verified.read_only
            || verified.project.project_id != project_id
            || verified
                .integrity_issues
                .iter()
                .any(|issue| issue.severity == "error")
        {
            return Err("projectStagingVerifyFailed".to_owned());
        }
        if target.exists() {
            return Err("projectTargetExists".to_owned());
        }
        fs::rename(&staging, &target).map_err(|_| "projectAtomicRenameFailed".to_owned())?;
        Ok(CreatedProject {
            root: target.to_string_lossy().into_owned(),
            project_id,
            first_chapter_id,
            created_file_count: preflight.created_file_count,
            created_directory_count: preflight.created_directory_count,
        })
    })();
    if result.is_err() && staging.exists() {
        let _ = fs::remove_dir_all(&staging);
    }
    result
}

fn project_move_error(code: &str) -> Result<(MoveCommand, String), String> {
    Err(code.to_owned())
}

fn apply_project_structure_move(
    project: &mut migration::WritingProject,
    command: &MoveCommand,
) -> Result<(MoveCommand, String), String> {
    if command.entity_ids.len() != 1 {
        return project_move_error("projectMoveMultipleUnsupported");
    }
    let entity_id = command
        .entity_ids
        .first()
        .ok_or_else(|| "projectMoveEntityMissing".to_owned())?;

    let (inverse_from, inverse_to, description) = if command.entity_type == "volume" {
        if command.from.container_id != project.project_id
            || command.to.container_id != project.project_id
        {
            return project_move_error("projectMoveContainerInvalid");
        }
        let source = project
            .volumes
            .get(command.from.index)
            .filter(|volume| volume.id == *entity_id)
            .cloned()
            .ok_or_else(|| "projectMoveSourceChanged".to_owned())?;
        if command.to.index >= project.volumes.len() {
            return project_move_error("projectMoveTargetIndexInvalid");
        }
        if command.from.index == command.to.index {
            return project_move_error("projectMoveNoChange");
        }
        project.volumes.remove(command.from.index);
        project.volumes.insert(command.to.index, source.clone());
        (
            command.to.clone(),
            command.from.clone(),
            format!(
                "已将“{}”移动到第 {} 位。",
                source.title,
                command.to.index + 1
            ),
        )
    } else if command.entity_type == "chapter" {
        let source_volume_index = project
            .volumes
            .iter()
            .position(|volume| volume.id == command.from.container_id)
            .ok_or_else(|| "projectMoveContainerInvalid".to_owned())?;
        let target_volume_index = project
            .volumes
            .iter()
            .position(|volume| volume.id == command.to.container_id)
            .ok_or_else(|| "projectMoveContainerInvalid".to_owned())?;
        let source = project.volumes[source_volume_index]
            .chapters
            .get(command.from.index)
            .filter(|chapter| chapter.id == *entity_id)
            .cloned()
            .ok_or_else(|| "projectMoveSourceChanged".to_owned())?;
        let same_volume = source_volume_index == target_volume_index;
        let target_length = project.volumes[target_volume_index].chapters.len();
        if (same_volume && command.to.index >= target_length)
            || (!same_volume && command.to.index > target_length)
        {
            return project_move_error("projectMoveTargetIndexInvalid");
        }
        if same_volume && command.from.index == command.to.index {
            return project_move_error("projectMoveNoChange");
        }
        project.volumes[source_volume_index]
            .chapters
            .remove(command.from.index);
        project.volumes[target_volume_index]
            .chapters
            .insert(command.to.index, source.clone());
        let target_title = project.volumes[target_volume_index].title.clone();
        (
            OrderedLocation {
                container_id: command.to.container_id.clone(),
                index: command.to.index,
            },
            OrderedLocation {
                container_id: command.from.container_id.clone(),
                index: command.from.index,
            },
            format!(
                "已将“{}”移动到{}第 {} 位。",
                source.title,
                target_title,
                command.to.index + 1
            ),
        )
    } else {
        return project_move_error("projectMoveEntityTypeUnsupported");
    };

    Ok((
        MoveCommand {
            command_id: format!("undo:{}", command.command_id),
            entity_type: command.entity_type.clone(),
            entity_ids: command.entity_ids.clone(),
            from: inverse_from,
            to: inverse_to,
            expected_project_revision: command.expected_project_revision.clone(),
        },
        description,
    ))
}

fn move_project_structure_on_disk(
    project_root: &str,
    command: &MoveCommand,
) -> Result<ProjectStructureMoveResult, String> {
    let root = filesystem::canonical_project_root(project_root)?;
    let manifest_path = root.join(".writing-buddy").join("project.json");
    let previous_bytes = fs::read(&manifest_path).map_err(|_| "manifestReadFailed".to_owned())?;
    let current_revision = filesystem::sha256(&previous_bytes);
    if command.expected_project_revision != current_revision {
        return Err(format!("projectRevisionConflict:{current_revision}"));
    }
    let mut project: migration::WritingProject =
        serde_json::from_slice(&previous_bytes).map_err(|_| "invalidManifest".to_owned())?;
    let (mut inverse_command, description) = apply_project_structure_move(&mut project, command)?;
    let mut next_bytes =
        serde_json::to_vec_pretty(&project).map_err(|_| "projectMoveSerializeFailed".to_owned())?;
    next_bytes.push(b'\n');
    let next_content =
        String::from_utf8(next_bytes).map_err(|_| "projectMoveSerializeFailed".to_owned())?;
    let write_result = filesystem::write_text_atomic(&AtomicWriteRequest {
        project_root: root.to_string_lossy().into_owned(),
        relative_path: ".writing-buddy/project.json".to_owned(),
        content: next_content,
        expected_hash: current_revision,
        eol: "lf".to_owned(),
        has_bom: false,
        force: false,
    })
    .map_err(|error| {
        if error.starts_with("externalChange:") {
            "projectRevisionConflict".to_owned()
        } else {
            "projectMoveWriteFailed".to_owned()
        }
    })?;
    let verified = migration::open_project(&root.to_string_lossy()).map_err(|_| {
        let _ = filesystem::write_bytes_atomic(&manifest_path, &previous_bytes);
        "projectMoveVerificationFailed".to_owned()
    })?;
    if verified.read_only || verified.project_revision != write_result.hash {
        let _ = filesystem::write_bytes_atomic(&manifest_path, &previous_bytes);
        return Err("projectMoveVerificationFailed".to_owned());
    }
    inverse_command.expected_project_revision = write_result.hash.clone();
    Ok(ProjectStructureMoveResult {
        project: verified.project,
        project_revision: write_result.hash,
        inverse_command,
        description,
    })
}

#[tauri::command]
pub fn move_project_structure(
    state: State<'_, AppState>,
    request: ProjectStructureMoveRequest,
) -> Result<ProjectStructureMoveResult, String> {
    require_write_lock(&state, &request.project_root)?;
    move_project_structure_on_disk(&request.project_root, &request.command)
}

#[tauri::command]
pub fn open_project(
    state: State<'_, AppState>,
    project_root: String,
    mode: Option<ProjectOpenMode>,
) -> Result<ProjectSnapshot, PublicProjectOpenError> {
    let mut snapshot = migration::open_project(&project_root)
        .map_err(|code| public_project_open_error(&code, &project_root))?;
    let mode = mode.unwrap_or(ProjectOpenMode::ReadWrite);
    if matches!(mode, ProjectOpenMode::ReadOnly) {
        snapshot.read_only = true;
    } else if !snapshot.read_only {
        process_lock::acquire(&state, &snapshot.root)
            .map_err(|code| public_project_open_error(&code, &snapshot.root))?;
    }
    let project_token = hex::encode(Sha256::digest(snapshot.project.project_id.as_bytes()));
    logging::event("project.open", "info", Some(&project_token[..12]), None);
    Ok(snapshot)
}

#[tauri::command]
pub fn repair_project(project_root: String) -> Result<ProjectRepairResult, PublicProjectOpenError> {
    let repaired = process_lock::repair_stale(&project_root)
        .map_err(|code| public_project_open_error(&code, &project_root))?;
    Ok(ProjectRepairResult {
        repaired,
        diagnostic_id: project_diagnostic_id("repair"),
    })
}

#[tauri::command]
pub fn reveal_project_directory(project_root: String) -> Result<(), String> {
    let root = filesystem::canonical_project_root(&project_root)?;
    #[cfg(windows)]
    let mut command = Command::new("explorer.exe");
    #[cfg(target_os = "macos")]
    let mut command = Command::new("open");
    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = Command::new("xdg-open");
    command
        .arg(root)
        .spawn()
        .map_err(|_| "projectDirectoryOpenFailed".to_owned())?;
    Ok(())
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
    let result = filesystem::write_text_atomic(&request)?;
    if request.relative_path.starts_with("story/")
        && crate::story::commands::invalidate_cached_index(&state, &request.project_root).is_err()
    {
        logging::event(
            "story.index.invalidate.failed",
            "warning",
            None,
            Some("storyIndexInvalidateFailed"),
        );
    }
    Ok(result)
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
    if lower.starts_with(".writing-buddy/cache/")
        || lower.starts_with(".writing-buddy/runtime/")
        || lower.starts_with(".writing-buddy/ai/tmp/")
        || lower.starts_with(".writing-buddy/ai/cache/")
    {
        None
    } else if lower == ".writing-buddy/project.json" {
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
    } else if lower.starts_with("story/") && lower.ends_with(".json") {
        Some("storyResource")
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
    crate::story::commands::invalidate_cached_index(&state, &project_root)?;
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
        state.clone(),
        project_root.clone(),
        "beforeRestore".to_owned(),
        Some("自动：恢复前".to_owned()),
    )?;
    let restored = archive::restore(&path, &project_root, overwrite)?;
    crate::story::commands::invalidate_cached_index(&state, &project_root)?;
    Ok(restored)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn project_creation_parent(label: &str) -> PathBuf {
        let nonce = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "writing-buddy-project-create-{label}-{}-{nonce}",
            std::process::id()
        ));
        fs::create_dir_all(&root).expect("create project parent");
        root
    }

    fn project_creation_request(
        root: &Path,
        name: &str,
        template_id: &str,
    ) -> CreateProjectRequest {
        CreateProjectRequest {
            name: name.to_owned(),
            description: "Sanitized creation test".to_owned(),
            root_directory: root.to_string_lossy().into_owned(),
            project_type: "longform".to_owned(),
            language: "zh-CN".to_owned(),
            template_id: template_id.to_owned(),
            selected_initial_resources: vec![
                "first-volume".to_owned(),
                "first-chapter".to_owned(),
                "character-category".to_owned(),
                "worldbuilding-category".to_owned(),
                "plot-and-foreshadowing".to_owned(),
                "ai-quick-actions".to_owned(),
            ],
            theme_id: "paper".to_owned(),
            accent_id: "gold".to_owned(),
            writing_mode: "manuscriptFirst".to_owned(),
        }
    }

    fn project_move_fixture(label: &str) -> PathBuf {
        let parent = project_creation_parent(label);
        let root = parent.join("Sanitized Move");
        fs::create_dir_all(root.join(".writing-buddy")).expect("create manifest directory");
        fs::create_dir_all(root.join("chapters")).expect("create chapter directory");
        for chapter in ["1", "2", "3", "4"] {
            fs::write(
                root.join("chapters").join(format!("{chapter}.md")),
                format!("# Chapter {chapter}\n"),
            )
            .expect("write chapter");
        }
        write_pretty_json(
            &root.join(".writing-buddy").join("project.json"),
            &json!({
                "schemaVersion": 1,
                "projectId": "project-a11ce001",
                "title": "Sanitized Move",
                "volumes": [
                    {
                        "id": "volume-a11ce001",
                        "title": "Volume One",
                        "chapters": [
                            {"id": "chapter-a11ce001", "title": "Chapter One", "file": "chapters/1.md", "scene": {}},
                            {"id": "chapter-a11ce002", "title": "Chapter Two", "file": "chapters/2.md", "scene": {}},
                            {"id": "chapter-a11ce003", "title": "Chapter Three", "file": "chapters/3.md", "scene": {}}
                        ]
                    },
                    {
                        "id": "volume-a11ce002",
                        "title": "Volume Two",
                        "chapters": [
                            {"id": "chapter-a11ce004", "title": "Chapter Four", "file": "chapters/4.md", "scene": {}}
                        ]
                    }
                ]
            }),
        )
        .expect("write project manifest");
        root
    }

    #[test]
    fn project_creation_preflight_rejects_reserved_duplicate_and_invalid_requests_without_writes() {
        let root = project_creation_parent("preflight");
        fs::create_dir(root.join("Existing")).expect("existing target");
        for (name, code) in [
            ("CON", "reservedProjectName"),
            ("bad:name", "invalidProjectNameCharacters"),
            ("Existing", "projectTargetExists"),
        ] {
            let result =
                preflight_project_creation(project_creation_request(&root, name, "blank-longform"));
            assert!(!result.valid);
            assert!(result.issues.iter().any(|issue| issue.code == code));
        }
        assert!(fs::read_dir(&root).expect("list parent").all(|entry| {
            !entry
                .expect("entry")
                .file_name()
                .to_string_lossy()
                .starts_with(".writing-buddy-project-staging-")
        }));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn all_built_in_templates_create_through_verified_staging_and_reopen() {
        let root = project_creation_parent("templates");
        for (index, template) in [
            "blank-longform",
            "mystery-longform",
            "fantasy-longform",
            "science-fiction-longform",
            "realist-fiction",
            "custom",
        ]
        .iter()
        .enumerate()
        {
            let mut request =
                project_creation_request(&root, &format!("Sanitized {index}"), template);
            request.theme_id = if index % 2 == 0 {
                "paper".to_owned()
            } else {
                "midnight".to_owned()
            };
            let created = create_project(request).expect("create project");
            let reopened = migration::open_project(&created.root).expect("reopen project");
            assert_eq!(reopened.project.project_id, created.project_id);
            assert_eq!(
                reopened
                    .appearance
                    .as_ref()
                    .map(|value| value.theme_id.as_str()),
                Some(if index % 2 == 0 { "paper" } else { "midnight" })
            );
            assert!(!reopened.read_only);
            assert!(created.first_chapter_id.is_some());
            let all_bytes = WalkDir::new(&created.root)
                .into_iter()
                .filter_map(Result::ok)
                .filter(|entry| entry.file_type().is_file())
                .flat_map(|entry| fs::read(entry.path()).unwrap_or_default())
                .collect::<Vec<_>>();
            assert!(!String::from_utf8_lossy(&all_bytes).contains("sk-"));
        }
        assert!(fs::read_dir(&root).expect("list parent").all(|entry| {
            !entry
                .expect("entry")
                .file_name()
                .to_string_lossy()
                .starts_with(".writing-buddy-project-staging-")
        }));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn creation_never_overwrites_an_existing_target_or_leaves_staging() {
        let root = project_creation_parent("collision");
        let request = project_creation_request(&root, "Existing", "blank-longform");
        fs::create_dir(root.join("Existing")).expect("existing target");
        assert_eq!(
            create_project(request).expect_err("must reject existing target"),
            "projectTargetExists"
        );
        assert!(fs::read_dir(&root).expect("list parent").all(|entry| {
            !entry
                .expect("entry")
                .file_name()
                .to_string_lossy()
                .starts_with(".writing-buddy-project-staging-")
        }));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn project_structure_moves_persist_reopen_and_undo_without_renaming_files() {
        let root = project_move_fixture("structure-move");
        let opened = migration::open_project(&root.to_string_lossy()).expect("open fixture");
        let command = MoveCommand {
            command_id: "move-chapter-2".to_owned(),
            entity_type: "chapter".to_owned(),
            entity_ids: vec!["chapter-a11ce002".to_owned()],
            from: OrderedLocation {
                container_id: "volume-a11ce001".to_owned(),
                index: 1,
            },
            to: OrderedLocation {
                container_id: "volume-a11ce002".to_owned(),
                index: 1,
            },
            expected_project_revision: opened.project_revision,
        };
        let moved = move_project_structure_on_disk(&root.to_string_lossy(), &command)
            .expect("move chapter across volumes");
        assert_eq!(
            moved.project.volumes[0]
                .chapters
                .iter()
                .map(|chapter| chapter.id.as_str())
                .collect::<Vec<_>>(),
            vec!["chapter-a11ce001", "chapter-a11ce003"]
        );
        assert_eq!(
            moved.project.volumes[1]
                .chapters
                .iter()
                .map(|chapter| (chapter.id.as_str(), chapter.file.as_str()))
                .collect::<Vec<_>>(),
            vec![
                ("chapter-a11ce004", "chapters/4.md"),
                ("chapter-a11ce002", "chapters/2.md")
            ]
        );
        let reopened = migration::open_project(&root.to_string_lossy()).expect("reopen moved");
        assert_eq!(reopened.project_revision, moved.project_revision);
        let restored =
            move_project_structure_on_disk(&root.to_string_lossy(), &moved.inverse_command)
                .expect("undo move");
        assert_eq!(
            restored.project.volumes[0]
                .chapters
                .iter()
                .map(|chapter| chapter.id.as_str())
                .collect::<Vec<_>>(),
            vec!["chapter-a11ce001", "chapter-a11ce002", "chapter-a11ce003"]
        );
        let _ = fs::remove_dir_all(root.parent().expect("fixture parent"));
    }

    #[test]
    fn project_structure_move_rejects_stale_revision_without_writes() {
        let root = project_move_fixture("structure-stale");
        let manifest = root.join(".writing-buddy").join("project.json");
        let before = fs::read(&manifest).expect("read manifest");
        let command = MoveCommand {
            command_id: "stale-volume".to_owned(),
            entity_type: "volume".to_owned(),
            entity_ids: vec!["volume-1".to_owned()],
            from: OrderedLocation {
                container_id: "project-move".to_owned(),
                index: 0,
            },
            to: OrderedLocation {
                container_id: "project-move".to_owned(),
                index: 1,
            },
            expected_project_revision: "stale-revision".to_owned(),
        };
        assert!(
            move_project_structure_on_disk(&root.to_string_lossy(), &command)
                .expect_err("stale revision must fail")
                .starts_with("projectRevisionConflict")
        );
        assert_eq!(fs::read(&manifest).expect("reread manifest"), before);
        let _ = fs::remove_dir_all(root.parent().expect("fixture parent"));
    }

    #[test]
    fn project_open_errors_are_structured_and_redacted() {
        let error =
            public_project_open_error("projectLocked:4242", r"C:\Users\Alice\Novel\Volume One");
        assert_eq!(error.code, "projectLocked");
        assert_eq!(error.stage, "acquire-lock");
        assert_eq!(
            error.safe_path.as_deref(),
            Some(r"C:\Users\***\Novel\Volume One")
        );
        assert!(error.can_open_read_only);
        assert!(!error.can_repair);
        assert!(error.diagnostic_id.starts_with("project-open-"));
        assert!(!error.diagnostic_id.contains("Alice"));
        assert!(!error.diagnostic_id.contains("4242"));
    }

    #[test]
    fn manifest_and_stale_lock_capabilities_are_explicit() {
        let manifest = public_project_open_error("manifestNotFound", r"D:\Novel");
        assert_eq!(manifest.stage, "read-manifest");
        assert!(!manifest.can_open_read_only);
        assert!(!manifest.can_repair);

        let stale = public_project_open_error("staleLockRemoveFailed", r"D:\Novel");
        assert_eq!(stale.stage, "acquire-lock");
        assert!(stale.can_open_read_only);
        assert!(stale.can_repair);
    }

    #[test]
    fn story_resources_participate_in_existing_snapshots() {
        assert_eq!(
            snapshot_kind("story/characters/character%3Alin-yue.json"),
            Some("storyResource")
        );
        assert_eq!(
            snapshot_kind(".writing-buddy/ai/pending-facts/index.json"),
            Some("aiState")
        );
        assert_eq!(
            snapshot_kind(".writing-buddy/ai/story-kernel-generation/index.json"),
            Some("aiState")
        );
        assert_eq!(
            snapshot_kind(".writing-buddy/cache/story-index-v1.json"),
            None
        );
        assert_eq!(snapshot_kind(".writing-buddy/ai/tmp/job-1.json"), None);
        assert_eq!(
            snapshot_kind(".writing-buddy/ai/cache/context-pack.json"),
            None
        );
    }
}
