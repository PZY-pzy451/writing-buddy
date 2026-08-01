use std::{
    collections::{BTreeSet, HashMap, HashSet},
    fs,
    path::{Path, PathBuf},
    process::Command,
    sync::atomic::{AtomicU64, Ordering},
};

use chrono::{SecondsFormat, Utc};
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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateChapterRequest {
    project_root: String,
    expected_project_revision: String,
    title: String,
    volume_id: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateChapterResult {
    project: migration::WritingProject,
    project_revision: String,
    chapter: migration::ChapterDescriptor,
    description: String,
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

fn create_chapter_on_disk(request: &CreateChapterRequest) -> Result<CreateChapterResult, String> {
    let root = filesystem::canonical_project_root(&request.project_root)?;
    let manifest_path = root.join(".writing-buddy").join("project.json");
    let previous_bytes = fs::read(&manifest_path).map_err(|_| "manifestReadFailed".to_owned())?;
    let current_revision = filesystem::sha256(&previous_bytes);
    if request.expected_project_revision != current_revision {
        return Err(format!("projectRevisionConflict:{current_revision}"));
    }
    let title = request.title.trim();
    if title.is_empty()
        || title.chars().count() > 120
        || title.contains('\r')
        || title.contains('\n')
    {
        return Err("chapterTitleInvalid".to_owned());
    }
    let mut project: migration::WritingProject =
        serde_json::from_slice(&previous_bytes).map_err(|_| "invalidManifest".to_owned())?;
    let nonce = format!(
        "{}:{}:{}:{}",
        project.project_id,
        title,
        Utc::now().timestamp_millis(),
        std::process::id()
    );
    let chapter_id = creation_id("chapter", &nonce);
    let sequence = (1..=9999)
        .find(|index| {
            !root
                .join("chapters")
                .join(format!("chapter-{index:03}.md"))
                .exists()
        })
        .ok_or_else(|| "chapterFileLimitReached".to_owned())?;
    let relative_path = format!("chapters/chapter-{sequence:03}.md");
    let chapter_path = root.join(&relative_path);
    let chapter = migration::ChapterDescriptor {
        id: chapter_id,
        title: title.to_owned(),
        file: relative_path,
        status: Some("draft".to_owned()),
        target_words: None,
        scene: migration::SceneMetadata::default(),
    };
    if project.volumes.is_empty() {
        project.volumes.push(migration::VolumeDescriptor {
            id: creation_id("volume", &format!("{nonce}:volume")),
            title: "第一卷".to_owned(),
            chapters: Vec::new(),
        });
    }
    let volume_index = request
        .volume_id
        .as_ref()
        .map(|volume_id| {
            project
                .volumes
                .iter()
                .position(|volume| volume.id == *volume_id)
                .ok_or_else(|| "chapterVolumeMissing".to_owned())
        })
        .transpose()?
        .unwrap_or(project.volumes.len() - 1);
    project.volumes[volume_index].chapters.push(chapter.clone());

    filesystem::write_bytes_atomic(&chapter_path, format!("# {title}\n\n").as_bytes())
        .map_err(|_| "chapterFileWriteFailed".to_owned())?;
    let write_result = (|| {
        let mut next_bytes = serde_json::to_vec_pretty(&project)
            .map_err(|_| "chapterManifestSerializeFailed".to_owned())?;
        next_bytes.push(b'\n');
        let next_content = String::from_utf8(next_bytes)
            .map_err(|_| "chapterManifestSerializeFailed".to_owned())?;
        filesystem::write_text_atomic(&AtomicWriteRequest {
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
                "chapterManifestWriteFailed".to_owned()
            }
        })
    })();
    let write_result = match write_result {
        Ok(result) => result,
        Err(error) => {
            let _ = fs::remove_file(&chapter_path);
            return Err(error);
        }
    };
    let verified = migration::open_project(&root.to_string_lossy());
    if !matches!(
        verified.as_ref(),
        Ok(snapshot)
            if !snapshot.read_only
                && snapshot.project_revision == write_result.hash
                && snapshot
                    .project
                    .volumes
                    .iter()
                    .flat_map(|volume| volume.chapters.iter())
                    .any(|candidate| candidate.id == chapter.id)
    ) {
        let _ = filesystem::write_bytes_atomic(&manifest_path, &previous_bytes);
        let _ = fs::remove_file(&chapter_path);
        return Err("chapterCreateVerificationFailed".to_owned());
    }
    let verified = verified.map_err(|_| "chapterCreateVerificationFailed".to_owned())?;
    Ok(CreateChapterResult {
        project: verified.project,
        project_revision: write_result.hash,
        chapter,
        description: format!("已创建“{title}”并保存。"),
    })
}

#[tauri::command]
pub fn create_chapter(
    state: State<'_, AppState>,
    request: CreateChapterRequest,
) -> Result<CreateChapterResult, String> {
    require_write_lock(&state, &request.project_root)?;
    create_chapter_on_disk(&request)
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
                "已将卷“{}”移动到第 {} 位；改变顺序，父级未改变。",
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
            if same_volume {
                format!(
                    "已将章节“{}”移动到“{}”第 {} 位；改变顺序，父级未改变。",
                    source.title,
                    target_title,
                    command.to.index + 1
                )
            } else {
                format!(
                    "已将章节“{}”移动到“{}”第 {} 位；改变父级并改变顺序。",
                    source.title,
                    target_title,
                    command.to.index + 1
                )
            },
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
    format: Option<String>,
) -> Result<Option<String>, String> {
    let file_name = Path::new(&suggested_name)
        .file_name()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .unwrap_or("chapter.md");
    let dialog = rfd::FileDialog::new()
        .set_title("将写作副本另存为")
        .set_file_name(file_name);
    let dialog = if format.as_deref() == Some("plain-text") {
        dialog.add_filter("纯文本", &["txt"])
    } else {
        dialog.add_filter("Markdown", &["md"])
    };
    let Some(path) = dialog.save_file() else {
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
    } else if lower.starts_with(".writing-buddy/inbox/") {
        Some("authorInbox")
    } else if lower.starts_with(".writing-buddy/creation/") {
        Some("creationJourney")
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

const CREATION_JOURNEY_RELATIVE_PATH: &str = ".writing-buddy/creation/journey.json";

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CreationJourneyState {
    schema_version: u8,
    revision: u64,
    project_id: String,
    start_route: String,
    stage: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    genre_input: Option<CreationJourneyGenreInput>,
    #[serde(skip_serializing_if = "Option::is_none")]
    story_outline: Option<CreationJourneyStoryOutline>,
    #[serde(skip_serializing_if = "Option::is_none")]
    genre_generation: Option<CreationJourneyGenreGeneration>,
    elements: Vec<CreationJourneyElement>,
    core: CreationJourneyCore,
    directions: Vec<CreationJourneyDirection>,
    selected_direction_ids: Vec<String>,
    outline: Vec<CreationJourneyOutlineNode>,
    chapters: Vec<CreationJourneyChapter>,
    guidance: CreationJourneyGuidance,
    locks: CreationJourneyLocks,
    impacts: Vec<CreationJourneyImpact>,
    stale: CreationJourneyStale,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CreationJourneyGenreInput {
    project_id: String,
    genre: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    premise: Option<String>,
    mode: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    scale: Option<String>,
    tones: Vec<String>,
    protagonist_hints: Vec<String>,
    required_elements: Vec<String>,
    excluded_elements: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    ending_preference: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    audience: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    structure_template_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CreationJourneyStoryOutline {
    id: String,
    project_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    title: Option<String>,
    genre: String,
    premise: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    theme_promise: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    protagonist_goal: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    central_conflict: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    stakes: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    mystery_question: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    ending_direction: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    structure_template_id: Option<String>,
    status: String,
    revision: u64,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CreationJourneySuggestedResource {
    title: String,
    summary: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    role: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    category: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CreationJourneyGenerationWarning {
    code: String,
    message: String,
    node_indexes: Vec<u8>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CreationJourneyGenreGeneration {
    suggested_characters: Vec<CreationJourneySuggestedResource>,
    suggested_world_rules: Vec<CreationJourneySuggestedResource>,
    warnings: Vec<CreationJourneyGenerationWarning>,
    generated_at: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CreationJourneyElement {
    id: String,
    category: String,
    text: String,
    locked: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CreationJourneyCore {
    one_sentence: String,
    protagonist: String,
    goal: String,
    obstacle: String,
    stakes: String,
    mystery: String,
    reader_experience: String,
    ending_direction: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    confirmed_at: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CreationJourneyDirection {
    id: String,
    title: String,
    premise: String,
    central_conflict: String,
    ending_promise: String,
    tone: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CreationJourneyOutlineNode {
    id: String,
    title: String,
    summary: String,
    purpose: String,
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    node_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    parent_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    order: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    goal: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    conflict: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    outcome: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    hook: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pov_hint: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    location_hint: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    character_hints: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pov_character_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    location_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    character_ids: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    plot_thread_ids: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    foreshadowing_ids: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    source: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    revision: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    resource_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CreationJourneyChapter {
    id: String,
    title: String,
    goal: String,
    summary: String,
    source_node_ids: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    resource_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CreationJourneyStale {
    directions: bool,
    outline: bool,
    chapters: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CreationJourneyGuidance {
    #[serde(skip_serializing_if = "Option::is_none")]
    current_question: Option<CreationJourneyGuidanceQuestion>,
    answers: Vec<CreationJourneyGuidanceAnswer>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CreationJourneyGuidanceQuestion {
    id: String,
    stage: String,
    prompt: String,
    rationale: String,
    options: Vec<CreationJourneyGuidanceOption>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CreationJourneyGuidanceOption {
    id: String,
    label: String,
    description: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CreationJourneyGuidanceAnswer {
    question_id: String,
    stage: String,
    source: String,
    answer_text: String,
    answered_at: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CreationJourneyLocks {
    core_fields: Vec<String>,
    direction_ids: Vec<String>,
    outline_node_ids: Vec<String>,
    chapter_ids: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CreationJourneyImpact {
    id: String,
    source_kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    source_id: Option<String>,
    target_kind: String,
    target_id: String,
    reason: String,
    status: String,
    created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    resolved_at: Option<String>,
}

fn valid_creation_journey_id(value: &str, prefix: &str) -> bool {
    value.strip_prefix(prefix).is_some_and(|leaf| {
        !leaf.is_empty()
            && leaf.chars().all(|character| {
                character.is_ascii_lowercase() || character.is_ascii_digit() || character == '-'
            })
    })
}

fn valid_creation_journey_text(value: &str, max_chars: usize, allow_empty: bool) -> bool {
    (allow_empty || !value.trim().is_empty())
        && value.chars().count() <= max_chars
        && !value.contains('\0')
}

fn valid_creation_journey_timestamp(value: &str) -> bool {
    value.ends_with('Z') && chrono::DateTime::parse_from_rfc3339(value).is_ok()
}

fn valid_creation_journey_optional_text(value: Option<&str>, max_chars: usize) -> bool {
    value.is_none_or(|text| valid_creation_journey_text(text, max_chars, true))
}

fn valid_creation_journey_string_list(values: &[String], max_items: usize) -> bool {
    values.len() <= max_items
        && values.iter().collect::<HashSet<_>>().len() == values.len()
        && values
            .iter()
            .all(|value| valid_creation_journey_text(value, 240, false))
}

fn valid_creation_journey_genre_input(input: &CreationJourneyGenreInput, project_id: &str) -> bool {
    input.project_id == project_id
        && valid_creation_journey_text(&input.genre, 240, true)
        && valid_creation_journey_optional_text(input.premise.as_deref(), 2_000)
        && matches!(input.mode.as_str(), "quick" | "deep")
        && input
            .scale
            .as_deref()
            .is_none_or(|value| matches!(value, "short" | "novella" | "novel" | "serial"))
        && valid_creation_journey_string_list(&input.tones, 12)
        && valid_creation_journey_string_list(&input.protagonist_hints, 12)
        && valid_creation_journey_string_list(&input.required_elements, 12)
        && valid_creation_journey_string_list(&input.excluded_elements, 12)
        && input.ending_preference.as_deref().is_none_or(|value| {
            matches!(
                value,
                "open" | "hopeful" | "tragic" | "bittersweet" | "surprising" | "unspecified"
            )
        })
        && valid_creation_journey_optional_text(input.audience.as_deref(), 500)
        && input
            .structure_template_id
            .as_deref()
            .is_none_or(|value| valid_creation_journey_text(value, 120, false))
}

fn valid_creation_journey_story_outline(
    outline: &CreationJourneyStoryOutline,
    project_id: &str,
) -> bool {
    valid_creation_journey_id(&outline.id, "journey-story-outline:")
        && outline.project_id == project_id
        && valid_creation_journey_optional_text(outline.title.as_deref(), 160)
        && valid_creation_journey_text(&outline.genre, 240, false)
        && valid_creation_journey_text(&outline.premise, 2_000, true)
        && [
            (outline.theme_promise.as_deref(), 2_000),
            (outline.protagonist_goal.as_deref(), 2_000),
            (outline.central_conflict.as_deref(), 2_000),
            (outline.stakes.as_deref(), 2_000),
            (outline.mystery_question.as_deref(), 2_000),
            (outline.ending_direction.as_deref(), 2_000),
            (outline.structure_template_id.as_deref(), 120),
        ]
        .iter()
        .all(|(value, max_chars)| valid_creation_journey_optional_text(*value, *max_chars))
        && matches!(
            outline.status.as_str(),
            "draft" | "confirmed" | "needs_review"
        )
        && outline.revision >= 1
        && valid_creation_journey_timestamp(&outline.created_at)
        && valid_creation_journey_timestamp(&outline.updated_at)
}

fn valid_creation_journey_suggested_resource(resource: &CreationJourneySuggestedResource) -> bool {
    valid_creation_journey_text(&resource.title, 160, false)
        && valid_creation_journey_text(&resource.summary, 2_000, false)
        && valid_creation_journey_optional_text(resource.role.as_deref(), 160)
        && valid_creation_journey_optional_text(resource.category.as_deref(), 160)
}

fn valid_creation_journey_genre_generation(generation: &CreationJourneyGenreGeneration) -> bool {
    generation.suggested_characters.len() <= 12
        && generation.suggested_world_rules.len() <= 12
        && generation
            .suggested_characters
            .iter()
            .all(valid_creation_journey_suggested_resource)
        && generation
            .suggested_world_rules
            .iter()
            .all(valid_creation_journey_suggested_resource)
        && generation.warnings.len() <= 24
        && generation.warnings.iter().all(|warning| {
            !warning.code.is_empty()
                && warning.code.chars().enumerate().all(|(index, character)| {
                    if index == 0 {
                        character.is_ascii_lowercase()
                    } else {
                        character.is_ascii_lowercase()
                            || character.is_ascii_digit()
                            || character == '-'
                    }
                })
                && valid_creation_journey_text(&warning.message, 1_000, false)
                && warning.node_indexes.len() <= 8
                && warning.node_indexes.iter().all(|index| *index <= 7)
                && warning.node_indexes.iter().collect::<HashSet<_>>().len()
                    == warning.node_indexes.len()
        })
        && valid_creation_journey_timestamp(&generation.generated_at)
}

fn valid_creation_journey_state(state: &CreationJourneyState) -> bool {
    if state.schema_version != 2
        || state.project_id.trim().is_empty()
        || state.project_id.chars().count() > 240
        || !matches!(
            state.start_route.as_str(),
            "genre" | "ideas" | "synopsis" | "character-world" | "outline" | "manuscript" | "blank"
        )
        || !matches!(
            state.stage.as_str(),
            "elements" | "core" | "directions" | "outline" | "chapters" | "writing"
        )
        || !(3..=8).contains(&state.elements.len())
        || !(state.directions.is_empty() || state.directions.len() == 3)
        || state.selected_direction_ids.len() > 2
        || state.outline.len() > 512
        || !(state.outline.is_empty()
            || (5..=8).contains(
                &state
                    .outline
                    .iter()
                    .filter(|node| {
                        node.node_type
                            .as_deref()
                            .is_none_or(|node_type| node_type == "story_beat")
                    })
                    .count(),
            ))
        || !(state.chapters.is_empty() || state.chapters.len() == 3)
        || !valid_creation_journey_timestamp(&state.created_at)
        || !valid_creation_journey_timestamp(&state.updated_at)
    {
        return false;
    }
    if (state.start_route == "genre" && state.genre_input.is_none())
        || state
            .genre_input
            .as_ref()
            .is_some_and(|input| !valid_creation_journey_genre_input(input, &state.project_id))
        || state.story_outline.as_ref().is_some_and(|outline| {
            !valid_creation_journey_story_outline(outline, &state.project_id)
        })
        || state
            .genre_generation
            .as_ref()
            .is_some_and(|generation| !valid_creation_journey_genre_generation(generation))
    {
        return false;
    }
    let valid_core = [
        (&state.core.one_sentence, 2_000),
        (&state.core.protagonist, 1_000),
        (&state.core.goal, 1_000),
        (&state.core.obstacle, 1_000),
        (&state.core.stakes, 1_000),
        (&state.core.mystery, 1_000),
        (&state.core.reader_experience, 1_000),
        (&state.core.ending_direction, 1_000),
    ]
    .iter()
    .all(|(value, max_chars)| valid_creation_journey_text(value, *max_chars, true))
        && state
            .core
            .confirmed_at
            .as_deref()
            .is_none_or(valid_creation_journey_timestamp);
    if !valid_core {
        return false;
    }

    let valid_categories = [
        "character",
        "place",
        "object",
        "event",
        "mood",
        "theme",
        "question",
        "other",
    ];
    let mut element_ids = HashSet::new();
    if !state.elements.iter().all(|element| {
        valid_creation_journey_id(&element.id, "journey-element:")
            && element_ids.insert(element.id.as_str())
            && valid_categories.contains(&element.category.as_str())
            && valid_creation_journey_text(&element.text, 500, true)
    }) {
        return false;
    }
    let mut direction_ids = HashSet::new();
    if !state.directions.iter().all(|direction| {
        valid_creation_journey_id(&direction.id, "journey-direction:")
            && direction_ids.insert(direction.id.as_str())
            && valid_creation_journey_text(&direction.title, 120, true)
            && valid_creation_journey_text(&direction.premise, 2_000, true)
            && valid_creation_journey_text(&direction.central_conflict, 2_000, true)
            && valid_creation_journey_text(&direction.ending_promise, 2_000, true)
            && valid_creation_journey_text(&direction.tone, 500, true)
    }) || state
        .selected_direction_ids
        .iter()
        .collect::<HashSet<_>>()
        .len()
        != state.selected_direction_ids.len()
        || state
            .selected_direction_ids
            .iter()
            .any(|id| !direction_ids.contains(id.as_str()))
    {
        return false;
    }
    let mut outline_ids = HashSet::new();
    let mut story_beat_order = 0_u64;
    if !state.outline.iter().all(|node| {
        let is_story_beat = node
            .node_type
            .as_deref()
            .is_none_or(|node_type| node_type == "story_beat");
        let valid_order =
            !is_story_beat || node.order.is_none_or(|order| order == story_beat_order);
        if is_story_beat {
            story_beat_order = story_beat_order.saturating_add(1);
        }
        valid_creation_journey_id(&node.id, "journey-outline:")
            && outline_ids.insert(node.id.as_str())
            && valid_creation_journey_text(&node.title, 120, true)
            && valid_creation_journey_text(&node.summary, 3_000, true)
            && valid_creation_journey_text(&node.purpose, 1_000, true)
            && node
                .node_type
                .as_deref()
                .is_none_or(|value| matches!(value, "story_beat" | "volume" | "chapter" | "scene"))
            && node
                .parent_id
                .as_deref()
                .is_none_or(|value| valid_creation_journey_text(value, 240, false))
            && valid_order
            && valid_creation_journey_optional_text(node.goal.as_deref(), 1_000)
            && valid_creation_journey_optional_text(node.conflict.as_deref(), 2_000)
            && valid_creation_journey_optional_text(node.outcome.as_deref(), 2_000)
            && valid_creation_journey_optional_text(node.hook.as_deref(), 2_000)
            && valid_creation_journey_optional_text(node.pov_hint.as_deref(), 500)
            && valid_creation_journey_optional_text(node.location_hint.as_deref(), 500)
            && node.character_hints.as_deref().is_none_or(|values| {
                values.len() <= 24
                    && values.iter().collect::<HashSet<_>>().len() == values.len()
                    && values
                        .iter()
                        .all(|value| valid_creation_journey_text(value, 160, false))
            })
            && valid_creation_journey_optional_text(node.pov_character_id.as_deref(), 240)
            && valid_creation_journey_optional_text(node.location_id.as_deref(), 240)
            && node
                .character_ids
                .as_deref()
                .is_none_or(|values| valid_creation_journey_string_list(values, 100))
            && node
                .plot_thread_ids
                .as_deref()
                .is_none_or(|values| valid_creation_journey_string_list(values, 100))
            && node
                .foreshadowing_ids
                .as_deref()
                .is_none_or(|values| valid_creation_journey_string_list(values, 100))
            && node.status.as_deref().is_none_or(|value| {
                matches!(
                    value,
                    "planned" | "ready_to_write" | "drafting" | "drafted" | "revising" | "complete"
                )
            })
            && node.source.as_deref().is_none_or(|value| {
                matches!(
                    value,
                    "manual" | "ai_generated" | "ai_revised" | "extracted_from_draft"
                )
            })
            && node.revision.is_none_or(|revision| revision >= 1)
            && node
                .resource_id
                .as_deref()
                .is_none_or(|id| match node.node_type.as_deref() {
                    Some("volume") => {
                        valid_creation_journey_id(id, "volume:")
                            || valid_creation_journey_id(id, "volume-")
                    }
                    Some("chapter") => {
                        valid_creation_journey_id(id, "chapter:")
                            || valid_creation_journey_id(id, "chapter-")
                    }
                    Some("scene") => valid_creation_journey_id(id, "scene:"),
                    _ => false,
                })
    }) {
        return false;
    }
    let outline_by_id = state
        .outline
        .iter()
        .map(|node| (node.id.as_str(), node))
        .collect::<HashMap<_, _>>();
    let hierarchy_nodes = state
        .outline
        .iter()
        .filter(|node| {
            matches!(
                node.node_type.as_deref(),
                Some("volume" | "chapter" | "scene")
            )
        })
        .collect::<Vec<_>>();
    let valid_hierarchy_parent =
        hierarchy_nodes
            .iter()
            .all(|node| match node.node_type.as_deref() {
                Some("volume") => node.parent_id.is_none(),
                Some("chapter") => node.parent_id.as_deref().is_some_and(|parent_id| {
                    outline_by_id
                        .get(parent_id)
                        .is_some_and(|parent| parent.node_type.as_deref() == Some("volume"))
                }),
                Some("scene") => node.parent_id.as_deref().is_some_and(|parent_id| {
                    outline_by_id
                        .get(parent_id)
                        .is_some_and(|parent| parent.node_type.as_deref() == Some("chapter"))
                }),
                _ => false,
            });
    let mut sibling_orders = HashMap::<String, Vec<u64>>::new();
    for node in &hierarchy_nodes {
        let Some(order) = node.order else {
            return false;
        };
        sibling_orders
            .entry(format!(
                "{}:{}",
                node.node_type.as_deref().unwrap_or_default(),
                node.parent_id.as_deref().unwrap_or("root")
            ))
            .or_default()
            .push(order);
    }
    let valid_hierarchy_order = sibling_orders.values_mut().all(|orders| {
        orders.sort_unstable();
        orders
            .iter()
            .enumerate()
            .all(|(index, order)| *order == index as u64)
    });
    if !valid_hierarchy_parent || !valid_hierarchy_order {
        return false;
    }
    let mut chapter_ids = HashSet::new();
    if !state.chapters.iter().all(|chapter| {
        valid_creation_journey_id(&chapter.id, "journey-chapter:")
            && chapter_ids.insert(chapter.id.as_str())
            && valid_creation_journey_text(&chapter.title, 120, true)
            && !chapter.title.contains(['\r', '\n'])
            && valid_creation_journey_text(&chapter.goal, 1_000, true)
            && valid_creation_journey_text(&chapter.summary, 3_000, true)
            && (1..=8).contains(&chapter.source_node_ids.len())
            && chapter.source_node_ids.iter().collect::<HashSet<_>>().len()
                == chapter.source_node_ids.len()
            && chapter
                .source_node_ids
                .iter()
                .all(|id| outline_ids.contains(id.as_str()))
            && chapter.resource_id.as_deref().is_none_or(|id| {
                valid_creation_journey_id(id, "chapter:")
                    || valid_creation_journey_id(id, "chapter-")
            })
    }) {
        return false;
    }
    let valid_stage = |stage: &str| {
        matches!(
            stage,
            "elements" | "core" | "directions" | "outline" | "chapters" | "writing"
        )
    };
    let valid_guidance = state.guidance.answers.len() <= 100
        && state.guidance.answers.iter().all(|answer| {
            valid_creation_journey_id(&answer.question_id, "journey-question:")
                && valid_stage(&answer.stage)
                && matches!(answer.source.as_str(), "option" | "custom")
                && valid_creation_journey_text(&answer.answer_text, 1_000, false)
                && valid_creation_journey_timestamp(&answer.answered_at)
        })
        && state
            .guidance
            .current_question
            .as_ref()
            .is_none_or(|question| {
                let mut option_ids = HashSet::new();
                valid_creation_journey_id(&question.id, "journey-question:")
                    && valid_stage(&question.stage)
                    && valid_creation_journey_text(&question.prompt, 500, false)
                    && valid_creation_journey_text(&question.rationale, 500, false)
                    && question.options.len() == 3
                    && question.options.iter().all(|option| {
                        valid_creation_journey_id(&option.id, "journey-option:")
                            && option_ids.insert(option.id.as_str())
                            && valid_creation_journey_text(&option.label, 120, false)
                            && valid_creation_journey_text(&option.description, 500, false)
                    })
            });
    if !valid_guidance {
        return false;
    }
    let valid_core_fields = [
        "oneSentence",
        "protagonist",
        "goal",
        "obstacle",
        "stakes",
        "mystery",
        "readerExperience",
        "endingDirection",
    ];
    if state.locks.core_fields.iter().collect::<HashSet<_>>().len() != state.locks.core_fields.len()
        || state
            .locks
            .core_fields
            .iter()
            .any(|field| !valid_core_fields.contains(&field.as_str()))
        || state
            .locks
            .direction_ids
            .iter()
            .collect::<HashSet<_>>()
            .len()
            != state.locks.direction_ids.len()
        || state
            .locks
            .direction_ids
            .iter()
            .any(|id| !direction_ids.contains(id.as_str()))
        || state
            .locks
            .outline_node_ids
            .iter()
            .collect::<HashSet<_>>()
            .len()
            != state.locks.outline_node_ids.len()
        || state
            .locks
            .outline_node_ids
            .iter()
            .any(|id| !outline_ids.contains(id.as_str()))
        || state.locks.chapter_ids.iter().collect::<HashSet<_>>().len()
            != state.locks.chapter_ids.len()
        || state
            .locks
            .chapter_ids
            .iter()
            .any(|id| !chapter_ids.contains(id.as_str()))
    {
        return false;
    }
    let mut impact_ids = HashSet::new();
    let mut pending_targets = HashSet::new();
    if state.impacts.len() > 500
        || !state.impacts.iter().all(|impact| {
            let target_has_valid_id = match impact.target_kind.as_str() {
                "direction" => valid_creation_journey_id(&impact.target_id, "journey-direction:"),
                "outline" => valid_creation_journey_id(&impact.target_id, "journey-outline:"),
                "chapter" => valid_creation_journey_id(&impact.target_id, "journey-chapter:"),
                _ => false,
            };
            let target_exists = match impact.target_kind.as_str() {
                "direction" => direction_ids.contains(impact.target_id.as_str()),
                "outline" => outline_ids.contains(impact.target_id.as_str()),
                "chapter" => chapter_ids.contains(impact.target_id.as_str()),
                _ => false,
            };
            let resolution_valid = match impact.status.as_str() {
                "pending" => impact.resolved_at.is_none(),
                "kept" | "updated" => impact
                    .resolved_at
                    .as_deref()
                    .is_some_and(valid_creation_journey_timestamp),
                _ => false,
            };
            let pending_unique = impact.status != "pending"
                || pending_targets.insert(format!("{}:{}", impact.target_kind, impact.target_id));
            valid_creation_journey_id(&impact.id, "journey-impact:")
                && impact_ids.insert(impact.id.as_str())
                && matches!(
                    impact.source_kind.as_str(),
                    "element" | "core" | "direction-selection" | "direction" | "outline"
                )
                && impact
                    .source_id
                    .as_deref()
                    .is_none_or(|id| valid_creation_journey_text(id, 240, false))
                && target_has_valid_id
                && (impact.status != "pending" || target_exists)
                && valid_creation_journey_text(&impact.reason, 500, false)
                && valid_creation_journey_timestamp(&impact.created_at)
                && resolution_valid
                && pending_unique
        })
    {
        return false;
    }
    let stale_matches_impacts = state.stale.directions
        == pending_targets
            .iter()
            .any(|target| target.starts_with("direction:"))
        && state.stale.outline
            == pending_targets
                .iter()
                .any(|target| target.starts_with("outline:"))
        && state.stale.chapters
            == pending_targets
                .iter()
                .any(|target| target.starts_with("chapter:"));
    if !stale_matches_impacts {
        return false;
    }
    let materialized_count = state
        .chapters
        .iter()
        .filter(|chapter| chapter.resource_id.is_some())
        .count();
    let materialized_hierarchy_count = hierarchy_nodes
        .iter()
        .filter(|node| node.resource_id.is_some())
        .count();
    (materialized_count == 0 || materialized_count == 3)
        && (materialized_hierarchy_count == 0
            || materialized_hierarchy_count == hierarchy_nodes.len())
        && (state.stage != "writing"
            || materialized_count == 3
            || (!hierarchy_nodes.is_empty()
                && materialized_hierarchy_count == hierarchy_nodes.len()))
}

fn parse_creation_journey_state(content: &str) -> Result<CreationJourneyState, String> {
    if content.len() > 1024 * 1024 {
        return Err("creationJourneyStateTooLarge".to_owned());
    }
    let state: CreationJourneyState =
        serde_json::from_str(content).map_err(|_| "creationJourneyStateInvalid".to_owned())?;
    if !valid_creation_journey_state(&state) {
        return Err("creationJourneyStateInvalid".to_owned());
    }
    Ok(state)
}

#[tauri::command]
pub fn read_creation_journey_state(project_root: String) -> Result<Option<TextFile>, String> {
    match filesystem::read_text(&project_root, CREATION_JOURNEY_RELATIVE_PATH) {
        Ok(file) => Ok(Some(file)),
        Err(error) if error == "resourceNotFound" => Ok(None),
        Err(error) => Err(error),
    }
}

#[tauri::command]
pub fn write_creation_journey_state(
    state: State<'_, AppState>,
    project_root: String,
    content: String,
    expected_hash: String,
) -> Result<AtomicWriteResult, String> {
    require_write_lock(&state, &project_root)?;
    parse_creation_journey_state(&content)?;
    filesystem::write_text_atomic(&AtomicWriteRequest {
        project_root,
        relative_path: CREATION_JOURNEY_RELATIVE_PATH.to_owned(),
        content,
        expected_hash,
        eol: "lf".to_owned(),
        has_bom: false,
        force: false,
    })
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct MaterializeCreationJourneyRequest {
    project_root: String,
    expected_project_revision: String,
    journey_content: String,
    expected_journey_hash: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MaterializeCreationJourneyResult {
    project: migration::WritingProject,
    project_revision: String,
    chapters: Vec<migration::ChapterDescriptor>,
    journey_content: String,
    journey_hash: String,
    description: String,
}

fn restore_creation_journey_file(path: &Path, previous: Option<&[u8]>) {
    if let Some(bytes) = previous {
        let _ = filesystem::write_bytes_atomic(path, bytes);
    } else if path.exists() {
        let _ = fs::remove_file(path);
    }
}

fn materialize_creation_journey_on_disk(
    request: &MaterializeCreationJourneyRequest,
) -> Result<MaterializeCreationJourneyResult, String> {
    let root = filesystem::canonical_project_root(&request.project_root)?;
    let manifest_path = root.join(".writing-buddy").join("project.json");
    let journey_path = root.join(CREATION_JOURNEY_RELATIVE_PATH);
    let previous_manifest =
        fs::read(&manifest_path).map_err(|_| "manifestReadFailed".to_owned())?;
    let current_project_revision = filesystem::sha256(&previous_manifest);
    if request.expected_project_revision != current_project_revision {
        return Err(format!(
            "projectRevisionConflict:{current_project_revision}"
        ));
    }
    let previous_journey = match fs::read(&journey_path) {
        Ok(bytes) => Some(bytes),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => None,
        Err(_) => return Err("creationJourneyReadFailed".to_owned()),
    };
    let current_journey_hash = previous_journey
        .as_deref()
        .map(filesystem::sha256)
        .unwrap_or_default();
    if request.expected_journey_hash != current_journey_hash {
        return Err(format!("externalChange:{current_journey_hash}"));
    }
    let mut journey = parse_creation_journey_state(&request.journey_content)?;
    let mut project: migration::WritingProject =
        serde_json::from_slice(&previous_manifest).map_err(|_| "invalidManifest".to_owned())?;
    if journey.project_id != project.project_id {
        return Err("creationJourneyProjectMismatch".to_owned());
    }
    if journey.stage != "chapters"
        || journey.chapters.len() != 3
        || journey
            .chapters
            .iter()
            .any(|chapter| chapter.resource_id.is_some())
        || journey.stale.chapters
        || journey.stale.outline
        || journey.selected_direction_ids.is_empty()
        || journey.chapters.iter().any(|chapter| {
            !valid_creation_journey_text(&chapter.title, 120, false)
                || !valid_creation_journey_text(&chapter.goal, 1_000, false)
                || !valid_creation_journey_text(&chapter.summary, 3_000, false)
        })
        || project
            .volumes
            .iter()
            .any(|volume| !volume.chapters.is_empty())
    {
        return Err("creationJourneyMaterializationInvalid".to_owned());
    }

    let mut sequences = Vec::new();
    for sequence in 1..=9999 {
        if !root
            .join("chapters")
            .join(format!("chapter-{sequence:03}.md"))
            .exists()
        {
            sequences.push(sequence);
            if sequences.len() == 3 {
                break;
            }
        }
    }
    if sequences.len() != 3 {
        return Err("chapterFileLimitReached".to_owned());
    }
    let nonce = format!(
        "{}:{}:{}",
        project.project_id,
        Utc::now().timestamp_millis(),
        std::process::id()
    );
    let chapters = journey
        .chapters
        .iter()
        .zip(sequences)
        .enumerate()
        .map(
            |(index, (proposal, sequence))| migration::ChapterDescriptor {
                id: creation_id("chapter", &format!("{nonce}:{index}")),
                title: proposal.title.trim().to_owned(),
                file: format!("chapters/chapter-{sequence:03}.md"),
                status: Some("draft".to_owned()),
                target_words: None,
                scene: migration::SceneMetadata::default(),
            },
        )
        .collect::<Vec<_>>();
    if project.volumes.is_empty() {
        project.volumes.push(migration::VolumeDescriptor {
            id: creation_id("volume", &format!("{nonce}:volume")),
            title: "第一卷".to_owned(),
            chapters: Vec::new(),
        });
    }
    project.volumes[0].chapters = chapters.clone();
    for (proposal, chapter) in journey.chapters.iter_mut().zip(&chapters) {
        proposal.resource_id = Some(chapter.id.clone());
    }
    journey.stage = "writing".to_owned();
    journey.revision = journey.revision.saturating_add(1);
    journey.updated_at = Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true);
    if !valid_creation_journey_state(&journey) {
        return Err("creationJourneyMaterializationInvalid".to_owned());
    }
    let mut manifest_bytes = serde_json::to_vec_pretty(&project)
        .map_err(|_| "chapterManifestSerializeFailed".to_owned())?;
    manifest_bytes.push(b'\n');
    let manifest_content = String::from_utf8(manifest_bytes)
        .map_err(|_| "chapterManifestSerializeFailed".to_owned())?;
    let mut journey_bytes = serde_json::to_vec_pretty(&journey)
        .map_err(|_| "creationJourneyStateInvalid".to_owned())?;
    journey_bytes.push(b'\n');
    let journey_content =
        String::from_utf8(journey_bytes).map_err(|_| "creationJourneyStateInvalid".to_owned())?;

    let mut created_paths = Vec::new();
    for chapter in &chapters {
        let path = root.join(&chapter.file);
        if let Err(error) =
            filesystem::write_bytes_atomic(&path, format!("# {}\n\n", chapter.title).as_bytes())
        {
            for created in &created_paths {
                let _ = fs::remove_file(created);
            }
            return Err(if error.is_empty() {
                "chapterFileWriteFailed".to_owned()
            } else {
                "chapterFileWriteFailed".to_owned()
            });
        }
        created_paths.push(path);
    }
    let manifest_write = filesystem::write_text_atomic(&AtomicWriteRequest {
        project_root: root.to_string_lossy().into_owned(),
        relative_path: ".writing-buddy/project.json".to_owned(),
        content: manifest_content,
        expected_hash: current_project_revision,
        eol: "lf".to_owned(),
        has_bom: false,
        force: false,
    });
    let manifest_write = match manifest_write {
        Ok(result) => result,
        Err(_) => {
            for path in &created_paths {
                let _ = fs::remove_file(path);
            }
            return Err("chapterManifestWriteFailed".to_owned());
        }
    };
    let journey_write = filesystem::write_text_atomic(&AtomicWriteRequest {
        project_root: root.to_string_lossy().into_owned(),
        relative_path: CREATION_JOURNEY_RELATIVE_PATH.to_owned(),
        content: journey_content.clone(),
        expected_hash: current_journey_hash,
        eol: "lf".to_owned(),
        has_bom: false,
        force: false,
    });
    let journey_write = match journey_write {
        Ok(result) => result,
        Err(_) => {
            let _ = filesystem::write_bytes_atomic(&manifest_path, &previous_manifest);
            for path in &created_paths {
                let _ = fs::remove_file(path);
            }
            return Err("creationJourneyWriteFailed".to_owned());
        }
    };
    let verified_project = migration::open_project(&root.to_string_lossy());
    let verified_journey =
        filesystem::read_text(&root.to_string_lossy(), CREATION_JOURNEY_RELATIVE_PATH).and_then(
            |file| {
                parse_creation_journey_state(&file.content)?;
                Ok(file)
            },
        );
    let verified = matches!(
        (&verified_project, &verified_journey),
        (Ok(snapshot), Ok(file))
            if !snapshot.read_only
                && snapshot.project_revision == manifest_write.hash
                && file.hash == journey_write.hash
                && chapters.iter().all(|chapter| snapshot
                    .project
                    .volumes
                    .iter()
                    .flat_map(|volume| &volume.chapters)
                    .any(|candidate| candidate.id == chapter.id))
    );
    if !verified {
        let _ = filesystem::write_bytes_atomic(&manifest_path, &previous_manifest);
        restore_creation_journey_file(&journey_path, previous_journey.as_deref());
        for path in &created_paths {
            let _ = fs::remove_file(path);
        }
        return Err("creationJourneyMaterializationVerificationFailed".to_owned());
    }
    let verified_project = verified_project
        .map_err(|_| "creationJourneyMaterializationVerificationFailed".to_owned())?;
    Ok(MaterializeCreationJourneyResult {
        project: verified_project.project,
        project_revision: manifest_write.hash,
        chapters,
        journey_content,
        journey_hash: journey_write.hash,
        description: "已创建 3 个开篇章节，并打开第一章。".to_owned(),
    })
}

#[tauri::command]
pub fn materialize_creation_journey(
    state: State<'_, AppState>,
    request: MaterializeCreationJourneyRequest,
) -> Result<MaterializeCreationJourneyResult, String> {
    require_write_lock(&state, &request.project_root)?;
    materialize_creation_journey_on_disk(&request)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct MaterializeOutlineHierarchyRequest {
    project_root: String,
    expected_project_revision: String,
    journey_content: String,
    expected_journey_hash: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MaterializeOutlineHierarchyResult {
    project: migration::WritingProject,
    project_revision: String,
    chapters: Vec<migration::ChapterDescriptor>,
    scene_ids: Vec<String>,
    journey_content: String,
    journey_hash: String,
    description: String,
}

struct OutlineHierarchyTransactionFile {
    path: PathBuf,
    original: Option<Vec<u8>>,
    bytes: Vec<u8>,
}

fn rollback_outline_hierarchy_files(
    files: &[OutlineHierarchyTransactionFile],
    committed: usize,
) -> Result<(), String> {
    let mut failed = false;
    for file in files[..committed].iter().rev() {
        let result = if let Some(original) = &file.original {
            filesystem::write_bytes_atomic(&file.path, original)
        } else if file.path.exists() {
            fs::remove_file(&file.path).map_err(|_| "outlineHierarchyRollbackFailed".to_owned())
        } else {
            Ok(())
        };
        failed |= result.is_err();
    }
    if failed {
        Err("outlineHierarchyRollbackFailed".to_owned())
    } else {
        Ok(())
    }
}

fn write_outline_hierarchy_transaction(
    files: &[OutlineHierarchyTransactionFile],
) -> Result<(), String> {
    let mut committed = 0_usize;
    for file in files {
        if filesystem::write_bytes_atomic(&file.path, &file.bytes).is_err() {
            return rollback_outline_hierarchy_files(files, committed)
                .and(Err("outlineHierarchyWriteFailed".to_owned()));
        }
        committed += 1;
    }
    Ok(())
}

fn utf16_len(value: &str) -> usize {
    value.encode_utf16().count()
}

fn story_creation_id(prefix: &str, seed: &str) -> String {
    let digest = hex::encode(Sha256::digest(seed.as_bytes()));
    format!("{prefix}:{}", &digest[..16])
}

fn normalized_hierarchy_title(value: &str) -> String {
    value
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}

fn materialize_outline_hierarchy_on_disk(
    request: &MaterializeOutlineHierarchyRequest,
) -> Result<MaterializeOutlineHierarchyResult, String> {
    let root = filesystem::canonical_project_root(&request.project_root)?;
    let manifest_path = root.join(".writing-buddy").join("project.json");
    let journey_path = root.join(CREATION_JOURNEY_RELATIVE_PATH);
    let previous_manifest =
        fs::read(&manifest_path).map_err(|_| "manifestReadFailed".to_owned())?;
    let current_project_revision = filesystem::sha256(&previous_manifest);
    if request.expected_project_revision != current_project_revision {
        return Err(format!(
            "projectRevisionConflict:{current_project_revision}"
        ));
    }
    let previous_journey = match fs::read(&journey_path) {
        Ok(bytes) => Some(bytes),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => None,
        Err(_) => return Err("creationJourneyReadFailed".to_owned()),
    };
    let current_journey_hash = previous_journey
        .as_deref()
        .map(filesystem::sha256)
        .unwrap_or_default();
    if request.expected_journey_hash != current_journey_hash {
        return Err(format!("externalChange:{current_journey_hash}"));
    }
    let mut journey = parse_creation_journey_state(&request.journey_content)?;
    let mut project: migration::WritingProject =
        serde_json::from_slice(&previous_manifest).map_err(|_| "invalidManifest".to_owned())?;
    if journey.project_id != project.project_id {
        return Err("creationJourneyProjectMismatch".to_owned());
    }

    let mut volume_nodes = journey
        .outline
        .iter()
        .filter(|node| node.node_type.as_deref() == Some("volume"))
        .collect::<Vec<_>>();
    volume_nodes.sort_by_key(|node| node.order.unwrap_or(u64::MAX));
    let mut chapter_nodes = journey
        .outline
        .iter()
        .filter(|node| node.node_type.as_deref() == Some("chapter"))
        .collect::<Vec<_>>();
    chapter_nodes.sort_by_key(|node| {
        let parent_order = volume_nodes
            .iter()
            .position(|volume| Some(volume.id.as_str()) == node.parent_id.as_deref())
            .unwrap_or(usize::MAX);
        (parent_order, node.order.unwrap_or(u64::MAX))
    });
    let mut scene_nodes = journey
        .outline
        .iter()
        .filter(|node| node.node_type.as_deref() == Some("scene"))
        .collect::<Vec<_>>();
    scene_nodes.sort_by_key(|node| {
        let parent_order = chapter_nodes
            .iter()
            .position(|chapter| Some(chapter.id.as_str()) == node.parent_id.as_deref())
            .unwrap_or(usize::MAX);
        (parent_order, node.order.unwrap_or(u64::MAX))
    });
    let hierarchy_ids = volume_nodes
        .iter()
        .chain(&chapter_nodes)
        .chain(&scene_nodes)
        .map(|node| node.id.as_str())
        .collect::<HashSet<_>>();
    if volume_nodes.is_empty()
        || chapter_nodes.is_empty()
        || scene_nodes.is_empty()
        || volume_nodes.iter().any(|volume| {
            !chapter_nodes
                .iter()
                .any(|chapter| chapter.parent_id.as_deref() == Some(volume.id.as_str()))
        })
        || chapter_nodes.iter().any(|chapter| {
            !scene_nodes
                .iter()
                .any(|scene| scene.parent_id.as_deref() == Some(chapter.id.as_str()))
        })
        || hierarchy_ids.len() != volume_nodes.len() + chapter_nodes.len() + scene_nodes.len()
        || volume_nodes
            .iter()
            .chain(&chapter_nodes)
            .chain(&scene_nodes)
            .any(|node| node.resource_id.is_some())
    {
        return Err("outlineHierarchyMaterializationInvalid".to_owned());
    }
    if journey
        .locks
        .outline_node_ids
        .iter()
        .any(|id| hierarchy_ids.contains(id.as_str()))
    {
        return Err("outlineHierarchyLocked".to_owned());
    }
    let existing_titles = project
        .volumes
        .iter()
        .flat_map(|volume| {
            std::iter::once(normalized_hierarchy_title(&volume.title)).chain(
                volume
                    .chapters
                    .iter()
                    .map(|chapter| normalized_hierarchy_title(&chapter.title)),
            )
        })
        .collect::<HashSet<_>>();
    if volume_nodes
        .iter()
        .chain(&chapter_nodes)
        .any(|node| existing_titles.contains(&normalized_hierarchy_title(&node.title)))
    {
        return Err("outlineHierarchyCanonicalConflict".to_owned());
    }

    let chapter_count = chapter_nodes.len();
    let mut sequences = Vec::with_capacity(chapter_count);
    for sequence in 1..=9999 {
        if !root
            .join("chapters")
            .join(format!("chapter-{sequence:03}.md"))
            .exists()
        {
            sequences.push(sequence);
            if sequences.len() == chapter_count {
                break;
            }
        }
    }
    if sequences.len() != chapter_count {
        return Err("chapterFileLimitReached".to_owned());
    }
    let nonce = format!(
        "{}:{}:{}",
        project.project_id,
        Utc::now().timestamp_millis(),
        std::process::id()
    );
    let mut canonical_ids = HashMap::<String, String>::new();
    for (index, volume) in volume_nodes.iter().enumerate() {
        canonical_ids.insert(
            volume.id.clone(),
            creation_id("volume", &format!("{nonce}:volume:{index}")),
        );
    }
    for (index, chapter) in chapter_nodes.iter().enumerate() {
        canonical_ids.insert(
            chapter.id.clone(),
            creation_id("chapter", &format!("{nonce}:chapter:{index}")),
        );
    }
    for (index, scene) in scene_nodes.iter().enumerate() {
        canonical_ids.insert(
            scene.id.clone(),
            story_creation_id("scene", &format!("{nonce}:scene:{index}")),
        );
    }

    let chapters = chapter_nodes
        .iter()
        .zip(&sequences)
        .map(|(node, sequence)| migration::ChapterDescriptor {
            id: canonical_ids
                .get(&node.id)
                .cloned()
                .expect("chapter canonical ID is prepared"),
            title: node.title.trim().to_owned(),
            file: format!("chapters/chapter-{sequence:03}.md"),
            status: Some("draft".to_owned()),
            target_words: None,
            scene: migration::SceneMetadata {
                location: String::new(),
                time: String::new(),
                pov: node
                    .pov_hint
                    .as_deref()
                    .unwrap_or_default()
                    .trim()
                    .to_owned(),
                characters: Vec::new(),
                goal: node.goal.as_deref().unwrap_or_default().trim().to_owned(),
                note: node.summary.trim().to_owned(),
            },
        })
        .collect::<Vec<_>>();
    let chapter_by_projection = chapter_nodes
        .iter()
        .zip(&chapters)
        .map(|(node, chapter)| (node.id.as_str(), chapter))
        .collect::<HashMap<_, _>>();
    let new_volumes = volume_nodes
        .iter()
        .map(|volume| migration::VolumeDescriptor {
            id: canonical_ids
                .get(&volume.id)
                .cloned()
                .expect("volume canonical ID is prepared"),
            title: volume.title.trim().to_owned(),
            chapters: chapter_nodes
                .iter()
                .filter(|chapter| chapter.parent_id.as_deref() == Some(volume.id.as_str()))
                .filter_map(|chapter| {
                    chapter_by_projection
                        .get(chapter.id.as_str())
                        .map(|descriptor| (*descriptor).clone())
                })
                .collect(),
        })
        .collect::<Vec<_>>();
    project.volumes.retain(|volume| !volume.chapters.is_empty());
    project.volumes.extend(new_volumes.clone());

    let timestamp = Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true);
    let mut chapter_files = Vec::<OutlineHierarchyTransactionFile>::new();
    let mut story_files = Vec::<OutlineHierarchyTransactionFile>::new();
    let mut scene_ids = Vec::with_capacity(scene_nodes.len());
    for (chapter_node, chapter) in chapter_nodes.iter().zip(&chapters) {
        let mut manuscript = format!("# {}\n\n", chapter.title);
        let mut chapter_scenes = scene_nodes
            .iter()
            .filter(|scene| scene.parent_id.as_deref() == Some(chapter_node.id.as_str()))
            .collect::<Vec<_>>();
        chapter_scenes.sort_by_key(|scene| scene.order.unwrap_or(u64::MAX));
        for (narrative_order, scene) in chapter_scenes.iter().enumerate() {
            let scene_id = canonical_ids
                .get(&scene.id)
                .cloned()
                .expect("scene canonical ID is prepared");
            let start = utf16_len(&manuscript);
            let section = format!(
                "## {}\n\n<!-- writing-buddy-scene:{scene_id} -->\n\n",
                scene.title.trim()
            );
            let end = start + utf16_len(&section);
            manuscript.push_str(&section);
            let quote = section.chars().take(500).collect::<String>();
            let story_scene = json!({
                "id": scene_id,
                "type": "scene",
                "title": scene.title.trim(),
                "summary": scene.summary.trim(),
                "aliases": [],
                "tags": [],
                "schemaVersion": 1,
                "createdAt": timestamp,
                "updatedAt": timestamp,
                "revision": 0,
                "chapterId": format!("chapter:{}", chapter.id),
                "manuscriptRange": {
                    "start": start,
                    "end": end,
                    "revision": 0,
                    "quote": quote
                },
                "narrativeOrder": narrative_order,
                "locationIds": [],
                "participantIds": [],
                "goal": scene.goal.as_deref().unwrap_or_default().trim(),
                "conflict": scene.conflict.as_deref().unwrap_or_default().trim(),
                "turn": scene.outcome.as_deref().unwrap_or_default().trim(),
                "outcome": scene.hook.as_deref().unwrap_or_default().trim(),
                "plotThreadIds": [],
                "revealInformationIds": [],
                "foreshadowingIds": [],
                "evidenceIds": []
            });
            let prepared = crate::story::storage::prepare_resource(
                &root,
                &crate::story::storage::StorySaveEntry {
                    resource: story_scene,
                    expected_revision: Some(0),
                    expected_absent: true,
                },
            )
            .map_err(|_| "outlineHierarchyMaterializationInvalid".to_owned())?;
            story_files.push(OutlineHierarchyTransactionFile {
                path: prepared.target,
                original: prepared.original,
                bytes: prepared.bytes,
            });
            scene_ids.push(scene_id);
        }
        chapter_files.push(OutlineHierarchyTransactionFile {
            path: root.join(&chapter.file),
            original: None,
            bytes: manuscript.into_bytes(),
        });
    }

    let volume_total = volume_nodes.len();
    let chapter_total = chapter_nodes.len();
    let scene_total = scene_nodes.len();
    drop(chapter_by_projection);
    drop(hierarchy_ids);
    drop(scene_nodes);
    drop(chapter_nodes);
    drop(volume_nodes);
    for node in &mut journey.outline {
        if let Some(resource_id) = canonical_ids.get(&node.id) {
            node.resource_id = Some(resource_id.clone());
        }
    }
    journey.stage = "writing".to_owned();
    journey.revision = journey.revision.saturating_add(1);
    journey.updated_at = timestamp;
    if !valid_creation_journey_state(&journey) {
        return Err("outlineHierarchyMaterializationInvalid".to_owned());
    }

    let mut manifest_bytes = serde_json::to_vec_pretty(&project)
        .map_err(|_| "outlineHierarchySerializeFailed".to_owned())?;
    manifest_bytes.push(b'\n');
    let mut journey_bytes = serde_json::to_vec_pretty(&journey)
        .map_err(|_| "outlineHierarchySerializeFailed".to_owned())?;
    journey_bytes.push(b'\n');
    let journey_content = String::from_utf8(journey_bytes.clone())
        .map_err(|_| "outlineHierarchySerializeFailed".to_owned())?;
    let mut transaction = Vec::new();
    transaction.extend(chapter_files);
    transaction.extend(story_files);
    transaction.push(OutlineHierarchyTransactionFile {
        path: manifest_path.clone(),
        original: Some(previous_manifest),
        bytes: manifest_bytes.clone(),
    });
    transaction.push(OutlineHierarchyTransactionFile {
        path: journey_path.clone(),
        original: previous_journey,
        bytes: journey_bytes.clone(),
    });
    write_outline_hierarchy_transaction(&transaction)?;

    let project_revision = filesystem::sha256(&manifest_bytes);
    let journey_hash = filesystem::sha256(&journey_bytes);
    let verified_project = migration::open_project(&root.to_string_lossy());
    let verified_journey = fs::read(&journey_path)
        .map_err(|_| "outlineHierarchyVerificationFailed".to_owned())
        .and_then(|bytes| {
            let content = String::from_utf8(bytes)
                .map_err(|_| "outlineHierarchyVerificationFailed".to_owned())?;
            parse_creation_journey_state(&content)
                .map_err(|_| "outlineHierarchyVerificationFailed".to_owned())
        });
    let verified_scenes = scene_ids.iter().all(|scene_id| {
        crate::story::storage::get_resource(&root.to_string_lossy(), "scene", scene_id).is_ok()
    });
    let verified = matches!(
        (&verified_project, &verified_journey),
        (Ok(snapshot), Ok(journey))
            if !snapshot.read_only
                && snapshot.project_revision == project_revision
                && journey.stage == "writing"
                && chapters.iter().all(|chapter| snapshot
                    .project
                    .volumes
                    .iter()
                    .flat_map(|volume| &volume.chapters)
                    .any(|candidate| candidate.id == chapter.id))
    ) && verified_scenes;
    if !verified {
        let _ = rollback_outline_hierarchy_files(&transaction, transaction.len());
        return Err("outlineHierarchyVerificationFailed".to_owned());
    }
    let verified_project =
        verified_project.map_err(|_| "outlineHierarchyVerificationFailed".to_owned())?;
    Ok(MaterializeOutlineHierarchyResult {
        project: verified_project.project,
        project_revision,
        chapters,
        scene_ids,
        journey_content,
        journey_hash,
        description: format!(
            "已创建 {} 卷、{} 章和 {} 个场景。",
            volume_total, chapter_total, scene_total
        ),
    })
}

#[tauri::command]
pub fn materialize_outline_hierarchy(
    state: State<'_, AppState>,
    request: MaterializeOutlineHierarchyRequest,
) -> Result<MaterializeOutlineHierarchyResult, String> {
    require_write_lock(&state, &request.project_root)?;
    let _transaction = state
        .story_transactions
        .lock()
        .map_err(|_| "storyTransactionLockFailed".to_owned())?;
    let root = filesystem::canonical_project_root(&request.project_root)?;
    let result = materialize_outline_hierarchy_on_disk(&request)?;
    if let Ok(mut indexes) = state.story_indexes.lock() {
        indexes.remove(&root);
    }
    Ok(result)
}

#[tauri::command]
pub fn read_quick_capture_state(project_root: String) -> Result<Option<TextFile>, String> {
    match filesystem::read_text(&project_root, ".writing-buddy/inbox/quick-captures.json") {
        Ok(file) => Ok(Some(file)),
        Err(error) if error == "resourceNotFound" => Ok(None),
        Err(error) => Err(error),
    }
}

fn valid_quick_capture_state(parsed: &serde_json::Value) -> bool {
    let Some(captures) = parsed.get("captures").and_then(serde_json::Value::as_array) else {
        return false;
    };
    if parsed.as_object().is_none_or(|value| value.len() != 2)
        || parsed
            .get("schemaVersion")
            .and_then(serde_json::Value::as_u64)
            != Some(1)
        || captures.len() > 10_000
    {
        return false;
    }
    let mut ids = HashSet::new();
    captures.iter().all(|capture| {
        let Some(value) = capture.as_object() else {
            return false;
        };
        let id = value.get("id").and_then(serde_json::Value::as_str);
        let project_id = value.get("projectId").and_then(serde_json::Value::as_str);
        let kind = value.get("type").and_then(serde_json::Value::as_str);
        let text = value.get("text").and_then(serde_json::Value::as_str);
        let status = value.get("status").and_then(serde_json::Value::as_str);
        let created_at = value.get("createdAt").and_then(serde_json::Value::as_str);
        let updated_at = value.get("updatedAt").and_then(serde_json::Value::as_str);
        id.is_some_and(|id| {
            id.starts_with("capture:") && id.len() <= 160 && ids.insert(id.to_owned())
        }) && project_id.is_some_and(|id| !id.trim().is_empty() && id.len() <= 240)
            && kind.is_some_and(|kind| {
                matches!(
                    kind,
                    "idea" | "revision" | "foreshadowing" | "character" | "world"
                )
            })
            && text.is_some_and(|text| !text.trim().is_empty() && text.len() <= 80_000)
            && status.is_some_and(|status| {
                matches!(status, "inbox" | "later" | "converted" | "dismissed")
            })
            && created_at.is_some_and(|value| value.ends_with('Z'))
            && updated_at.is_some_and(|value| value.ends_with('Z'))
    })
}

#[tauri::command]
pub fn write_quick_capture_state(
    state: State<'_, AppState>,
    project_root: String,
    content: String,
    expected_hash: String,
) -> Result<AtomicWriteResult, String> {
    require_write_lock(&state, &project_root)?;
    if content.len() > 2 * 1024 * 1024 {
        return Err("quickCaptureStateTooLarge".to_owned());
    }
    let parsed: serde_json::Value =
        serde_json::from_str(&content).map_err(|_| "quickCaptureStateInvalid".to_owned())?;
    if !valid_quick_capture_state(&parsed) {
        return Err("quickCaptureStateInvalid".to_owned());
    }
    filesystem::write_text_atomic(&AtomicWriteRequest {
        project_root,
        relative_path: ".writing-buddy/inbox/quick-captures.json".to_owned(),
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
    fn chapter_creation_writes_manuscript_and_manifest_then_reopens() {
        let root = project_move_fixture("chapter-create");
        let opened = migration::open_project(&root.to_string_lossy()).expect("open fixture");
        let request = CreateChapterRequest {
            project_root: root.to_string_lossy().into_owned(),
            expected_project_revision: opened.project_revision,
            title: "第五章 雨停以后".to_owned(),
            volume_id: Some("volume-a11ce002".to_owned()),
        };

        let created = create_chapter_on_disk(&request).expect("create chapter");
        assert_eq!(created.chapter.title, "第五章 雨停以后");
        assert_eq!(
            fs::read_to_string(root.join(&created.chapter.file)).expect("read manuscript"),
            "# 第五章 雨停以后\n\n"
        );
        let reopened = migration::open_project(&root.to_string_lossy()).expect("reopen");
        let target = reopened
            .project
            .volumes
            .iter()
            .find(|volume| volume.id == "volume-a11ce002")
            .expect("target volume");
        assert_eq!(
            target.chapters.last().map(|chapter| chapter.id.as_str()),
            Some(created.chapter.id.as_str())
        );
        assert_eq!(reopened.project_revision, created.project_revision);
        let _ = fs::remove_dir_all(root.parent().expect("fixture parent"));
    }

    #[test]
    fn chapter_creation_rejects_stale_revision_without_writes() {
        let root = project_move_fixture("chapter-create-stale");
        let before = WalkDir::new(&root)
            .into_iter()
            .filter_map(Result::ok)
            .filter(|entry| entry.file_type().is_file())
            .map(|entry| entry.path().to_path_buf())
            .collect::<BTreeSet<_>>();
        let request = CreateChapterRequest {
            project_root: root.to_string_lossy().into_owned(),
            expected_project_revision: "stale".to_owned(),
            title: "不会创建".to_owned(),
            volume_id: None,
        };

        assert!(
            create_chapter_on_disk(&request)
                .expect_err("stale revision")
                .starts_with("projectRevisionConflict:")
        );
        let after = WalkDir::new(&root)
            .into_iter()
            .filter_map(Result::ok)
            .filter(|entry| entry.file_type().is_file())
            .map(|entry| entry.path().to_path_buf())
            .collect::<BTreeSet<_>>();
        assert_eq!(after, before);
        let _ = fs::remove_dir_all(root.parent().expect("fixture parent"));
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
        assert_eq!(
            snapshot_kind(".writing-buddy/inbox/quick-captures.json"),
            Some("authorInbox")
        );
        assert_eq!(
            snapshot_kind(".writing-buddy/creation/journey.json"),
            Some("creationJourney")
        );
    }

    #[test]
    fn quick_capture_state_validation_rejects_unknown_and_duplicate_records() {
        let valid = json!({
            "schemaVersion": 1,
            "captures": [{
                "id": "capture:idea-001",
                "projectId": "project-001",
                "type": "idea",
                "text": "让玻璃顶在终章再次出现",
                "status": "inbox",
                "createdAt": "2026-07-29T00:00:00.000Z",
                "updatedAt": "2026-07-29T00:00:00.000Z"
            }]
        });
        assert!(valid_quick_capture_state(&valid));
        assert!(!valid_quick_capture_state(&json!({
            "schemaVersion": 1,
            "captures": [{
                "id": "capture:idea-001",
                "projectId": "project-001",
                "type": "unknown",
                "text": "记录",
                "status": "inbox",
                "createdAt": "2026-07-29T00:00:00.000Z",
                "updatedAt": "2026-07-29T00:00:00.000Z"
            }]
        })));
        assert!(!valid_quick_capture_state(&json!({
            "schemaVersion": 1,
            "captures": [valid["captures"][0].clone(), valid["captures"][0].clone()]
        })));
    }

    fn creation_journey_fixture(project_id: &str) -> String {
        json!({
            "schemaVersion": 2,
            "revision": 8,
            "projectId": project_id,
            "startRoute": "ideas",
            "stage": "chapters",
            "elements": [
                {"id": "journey-element:station", "category": "place", "text": "旧车站玻璃顶", "locked": false},
                {"id": "journey-element:reporter", "category": "character", "text": "失忆记者", "locked": false},
                {"id": "journey-element:rain", "category": "event", "text": "每天重置的夜雨", "locked": false}
            ],
            "core": {
                "oneSentence": "失忆记者必须在一夜内找回被抹去的车站事故真相。",
                "protagonist": "失忆记者林越",
                "goal": "找回事发当夜的记忆并公开真相",
                "obstacle": "操控记忆的站长与不断重置的夜晚",
                "stakes": "失败会让整座城市忘记失踪者",
                "mystery": "玻璃顶上的雨痕为什么每天完全相同",
                "readerExperience": "克制、悬疑、压迫",
                "endingDirection": "公开真相但放弃最后一段私人记忆",
                "confirmedAt": "2026-07-30T01:00:00.000Z"
            },
            "directions": [
                {"id": "journey-direction:truth", "title": "公开真相", "premise": "调查事故", "centralConflict": "真相与记忆冲突", "endingPromise": "公开换遗忘", "tone": "克制悬疑"},
                {"id": "journey-direction:loop", "title": "打破循环", "premise": "逃离雨夜", "centralConflict": "每次接近出口都会失忆", "endingPromise": "主动留下守门", "tone": "高概念惊悚"},
                {"id": "journey-direction:family", "title": "寻找姐姐", "premise": "寻找失踪亲人", "centralConflict": "姐姐可能制造了循环", "endingPromise": "姐妹做出艰难选择", "tone": "情感悬疑"}
            ],
            "selectedDirectionIds": ["journey-direction:truth"],
            "outline": [
                {"id": "journey-outline:one", "title": "进入车站", "summary": "主角进入旧站", "purpose": "建立异常"},
                {"id": "journey-outline:two", "title": "发现雨痕", "summary": "雨痕重复出现", "purpose": "提出谜题"},
                {"id": "journey-outline:three", "title": "记忆缺口", "summary": "主角失去新记忆", "purpose": "提高代价"},
                {"id": "journey-outline:four", "title": "站长阻拦", "summary": "站长暴露目的", "purpose": "正面冲突"},
                {"id": "journey-outline:five", "title": "第一次选择", "summary": "主角决定继续调查", "purpose": "形成章节钩子"}
            ],
            "chapters": [
                {"id": "journey-chapter:one", "title": "夜雨站台", "goal": "进入异常空间", "summary": "记者抵达旧车站", "sourceNodeIds": ["journey-outline:one", "journey-outline:two"]},
                {"id": "journey-chapter:two", "title": "缺失的七分钟", "goal": "发现记忆代价", "summary": "记者发现记忆缺口", "sourceNodeIds": ["journey-outline:three"]},
                {"id": "journey-chapter:three", "title": "站长的条件", "goal": "做出首次主动选择", "summary": "记者拒绝站长的交换", "sourceNodeIds": ["journey-outline:four", "journey-outline:five"]}
            ],
            "guidance": {"answers": []},
            "locks": {
                "coreFields": [],
                "directionIds": [],
                "outlineNodeIds": [],
                "chapterIds": []
            },
            "impacts": [],
            "stale": {"directions": false, "outline": false, "chapters": false},
            "createdAt": "2026-07-30T00:00:00.000Z",
            "updatedAt": "2026-07-30T01:00:00.000Z"
        })
        .to_string()
    }

    fn writable_hierarchy_fixture(project_id: &str, locked: bool) -> String {
        let mut state: serde_json::Value =
            serde_json::from_str(&creation_journey_fixture(project_id)).expect("valid journey");
        state["stage"] = json!("outline");
        state["chapters"] = json!([]);
        state["outline"]
            .as_array_mut()
            .expect("outline array")
            .extend([
                json!({
                    "id": "journey-outline:volume-one",
                    "type": "volume",
                    "order": 0,
                    "title": "第一卷 雨夜来客",
                    "summary": "记者发现旧车站与失踪案有关。",
                    "purpose": "建立谜团",
                    "goal": "进入旧站",
                    "conflict": "记忆开始消退",
                    "outcome": "记者决定继续调查",
                    "hook": "玻璃顶出现第二组雨痕",
                    "status": "planned",
                    "source": "ai_generated",
                    "revision": 1
                }),
                json!({
                    "id": "journey-outline:chapter-one",
                    "type": "chapter",
                    "parentId": "journey-outline:volume-one",
                    "order": 0,
                    "title": "第一章 夜雨名单",
                    "summary": "记者在旧站取得失踪者名单。",
                    "purpose": "取得名单",
                    "goal": "拍下名单",
                    "conflict": "站长阻止",
                    "outcome": "发现自己的名字",
                    "hook": "停运列车亮灯",
                    "povHint": "记者",
                    "status": "planned",
                    "source": "ai_generated",
                    "revision": 1
                }),
                json!({
                    "id": "journey-outline:scene-one",
                    "type": "scene",
                    "parentId": "journey-outline:chapter-one",
                    "order": 0,
                    "title": "玻璃顶下的名单",
                    "summary": "记者潜入候车厅拍摄名单。",
                    "purpose": "取得证据",
                    "goal": "拍下名单",
                    "conflict": "站长封锁出口",
                    "outcome": "名单出现记者姓名",
                    "hook": "停运列车亮灯",
                    "povHint": "记者",
                    "locationHint": "旧车站候车厅",
                    "characterHints": ["记者", "站长"],
                    "status": "ready_to_write",
                    "source": "ai_generated",
                    "revision": 1
                }),
            ]);
        if locked {
            state["locks"]["outlineNodeIds"] = json!(["journey-outline:chapter-one"]);
        }
        state.to_string()
    }

    #[test]
    fn creation_journey_v2_rejects_orphan_locks_and_stale_mismatches() {
        let mut orphan_lock: serde_json::Value =
            serde_json::from_str(&creation_journey_fixture("journey-contract"))
                .expect("valid fixture");
        orphan_lock["locks"]["directionIds"] = json!(["journey-direction:missing"]);
        assert_eq!(
            parse_creation_journey_state(&orphan_lock.to_string())
                .expect_err("orphan lock must be rejected"),
            "creationJourneyStateInvalid"
        );

        let mut stale_mismatch: serde_json::Value =
            serde_json::from_str(&creation_journey_fixture("journey-contract"))
                .expect("valid fixture");
        stale_mismatch["stale"]["directions"] = json!(true);
        assert_eq!(
            parse_creation_journey_state(&stale_mismatch.to_string())
                .expect_err("stale flags must match pending impacts"),
            "creationJourneyStateInvalid"
        );
    }

    #[test]
    fn creation_journey_v2_accepts_project_owned_genre_outline_fields() {
        let mut genre: serde_json::Value =
            serde_json::from_str(&creation_journey_fixture("journey-contract"))
                .expect("valid fixture");
        genre["startRoute"] = json!("genre");
        genre["genreInput"] = json!({
            "projectId": "journey-contract",
            "genre": "都市悬疑",
            "premise": "记者追查一座会重置记忆的车站。",
            "mode": "deep",
            "scale": "novel",
            "tones": ["克制"],
            "protagonistHints": ["调查记者"],
            "requiredElements": ["旧车站"],
            "excludedElements": ["穿越"],
            "endingPreference": "bittersweet",
            "audience": "成年悬疑读者",
            "structureTemplateId": "three-act"
        });
        genre["storyOutline"] = json!({
            "id": "journey-story-outline:main",
            "projectId": "journey-contract",
            "title": "雨夜无日期",
            "genre": "都市悬疑",
            "premise": "记者追查一座会重置记忆的车站。",
            "centralConflict": "公开真相会失去私人记忆",
            "status": "draft",
            "revision": 1,
            "createdAt": "2026-07-30T01:00:00.000Z",
            "updatedAt": "2026-07-30T01:00:00.000Z"
        });
        genre["genreGeneration"] = json!({
            "suggestedCharacters": [{
                "title": "无日期者",
                "summary": "事故名单中被抹除的幸存者。",
                "role": "deuteragonist"
            }],
            "suggestedWorldRules": [],
            "warnings": [{
                "code": "memory-cost",
                "message": "需要保持记忆代价可追踪。",
                "nodeIndexes": [1, 2]
            }],
            "generatedAt": "2026-07-30T01:00:00.000Z"
        });
        genre["outline"][0]["type"] = json!("story_beat");
        genre["outline"][0]["order"] = json!(0);
        genre["outline"][0]["goal"] = json!("建立调查目标");
        genre["outline"][0]["conflict"] = json!("陌生人拒绝合作");
        genre["outline"][0]["outcome"] = json!("得到事故车票");
        genre["outline"][0]["hook"] = json!("车票日期消失");
        genre["outline"][0]["povHint"] = json!("调查记者");
        genre["outline"][0]["characterIds"] = json!([]);
        genre["outline"][0]["plotThreadIds"] = json!([]);
        genre["outline"][0]["foreshadowingIds"] = json!([]);
        genre["outline"][0]["status"] = json!("planned");
        genre["outline"][0]["source"] = json!("ai_generated");
        genre["outline"][0]["revision"] = json!(1);

        assert!(parse_creation_journey_state(&genre.to_string()).is_ok());

        genre["genreInput"]["projectId"] = json!("foreign-project");
        assert_eq!(
            parse_creation_journey_state(&genre.to_string())
                .expect_err("foreign genre input must be rejected"),
            "creationJourneyStateInvalid"
        );
    }

    #[test]
    fn creation_journey_materializes_exactly_three_chapters_once() {
        let parent = project_creation_parent("journey-materialize");
        let mut create_request =
            project_creation_request(&parent, "Journey Novel", "blank-longform");
        create_request.selected_initial_resources = vec!["first-volume".to_owned()];
        let created = create_project(create_request).expect("create empty journey project");
        let before = migration::open_project(&created.root).expect("open empty project");
        let journey_content = creation_journey_fixture(&created.project_id);
        let request = MaterializeCreationJourneyRequest {
            project_root: created.root.clone(),
            expected_project_revision: before.project_revision,
            journey_content: journey_content.clone(),
            expected_journey_hash: String::new(),
        };

        let result =
            materialize_creation_journey_on_disk(&request).expect("materialize three chapters");

        assert_eq!(result.chapters.len(), 3);
        assert_eq!(result.project.volumes[0].chapters.len(), 3);
        assert!(result.chapters.iter().all(|chapter| {
            Path::new(&created.root).join(&chapter.file).is_file()
                && fs::read_to_string(Path::new(&created.root).join(&chapter.file))
                    .is_ok_and(|content| content.starts_with(&format!("# {}", chapter.title)))
        }));
        let saved = parse_creation_journey_state(&result.journey_content)
            .expect("parse materialized journey");
        assert_eq!(saved.stage, "writing");
        assert!(
            saved
                .chapters
                .iter()
                .all(|chapter| chapter.resource_id.is_some())
        );

        let retry = MaterializeCreationJourneyRequest {
            project_root: created.root.clone(),
            expected_project_revision: result.project_revision.clone(),
            journey_content,
            expected_journey_hash: result.journey_hash,
        };
        assert_eq!(
            materialize_creation_journey_on_disk(&retry).expect_err("must not duplicate chapters"),
            "creationJourneyMaterializationInvalid"
        );
        let reopened = migration::open_project(&created.root).expect("reopen materialized project");
        assert_eq!(reopened.project.volumes[0].chapters.len(), 3);
        let _ = fs::remove_dir_all(parent);
    }

    #[test]
    fn invalid_creation_journey_leaves_project_and_files_unchanged() {
        let parent = project_creation_parent("journey-invalid");
        let mut create_request =
            project_creation_request(&parent, "Invalid Journey", "blank-longform");
        create_request.selected_initial_resources = vec!["first-volume".to_owned()];
        let created = create_project(create_request).expect("create empty journey project");
        let before = migration::open_project(&created.root).expect("open empty project");
        let before_manifest =
            fs::read(Path::new(&created.root).join(".writing-buddy/project.json"))
                .expect("read manifest");
        let mut invalid: serde_json::Value =
            serde_json::from_str(&creation_journey_fixture(&created.project_id))
                .expect("valid fixture");
        invalid["chapters"].as_array_mut().expect("chapters").pop();
        let request = MaterializeCreationJourneyRequest {
            project_root: created.root.clone(),
            expected_project_revision: before.project_revision,
            journey_content: invalid.to_string(),
            expected_journey_hash: String::new(),
        };

        assert_eq!(
            materialize_creation_journey_on_disk(&request).expect_err("must reject invalid state"),
            "creationJourneyStateInvalid"
        );
        assert_eq!(
            fs::read(Path::new(&created.root).join(".writing-buddy/project.json"))
                .expect("reread manifest"),
            before_manifest
        );
        assert!(!Path::new(&created.root).join("chapters").exists());
        assert!(
            !Path::new(&created.root)
                .join(CREATION_JOURNEY_RELATIVE_PATH)
                .exists()
        );
        let _ = fs::remove_dir_all(parent);
    }

    #[test]
    fn outline_hierarchy_materializes_canonical_chapters_and_story_scenes() {
        let parent = project_creation_parent("outline-hierarchy-materialize");
        let mut create_request =
            project_creation_request(&parent, "Writable Outline", "blank-longform");
        create_request.selected_initial_resources = vec!["first-volume".to_owned()];
        let created = create_project(create_request).expect("create empty hierarchy project");
        let before = migration::open_project(&created.root).expect("open empty project");
        let request = MaterializeOutlineHierarchyRequest {
            project_root: created.root.clone(),
            expected_project_revision: before.project_revision,
            journey_content: writable_hierarchy_fixture(&created.project_id, false),
            expected_journey_hash: String::new(),
        };

        let result =
            materialize_outline_hierarchy_on_disk(&request).expect("materialize hierarchy");

        assert_eq!(result.project.volumes.len(), 1);
        assert_eq!(result.chapters.len(), 1);
        assert_eq!(result.scene_ids.len(), 1);
        let chapter = &result.chapters[0];
        let manuscript = fs::read_to_string(Path::new(&created.root).join(&chapter.file))
            .expect("read generated manuscript");
        assert!(manuscript.contains("<!-- writing-buddy-scene:scene:"));
        let scene =
            crate::story::storage::get_resource(&created.root, "scene", &result.scene_ids[0])
                .expect("read canonical scene")
                .expect("canonical scene exists");
        assert_eq!(scene["chapterId"], json!(format!("chapter:{}", chapter.id)));
        assert_eq!(scene["revision"], json!(1));
        let end = scene["manuscriptRange"]["end"].as_u64().expect("range end") as usize;
        assert!(end <= manuscript.encode_utf16().count());
        let saved = parse_creation_journey_state(&result.journey_content)
            .expect("parse materialized hierarchy journey");
        assert_eq!(saved.stage, "writing");
        assert!(
            saved
                .outline
                .iter()
                .filter(|node| matches!(
                    node.node_type.as_deref(),
                    Some("volume" | "chapter" | "scene")
                ))
                .all(|node| node.resource_id.is_some())
        );
        let _ = fs::remove_dir_all(parent);
    }

    #[test]
    fn outline_hierarchy_rejects_locked_nodes_without_writing() {
        let parent = project_creation_parent("outline-hierarchy-locked");
        let mut create_request =
            project_creation_request(&parent, "Locked Outline", "blank-longform");
        create_request.selected_initial_resources = vec!["first-volume".to_owned()];
        let created = create_project(create_request).expect("create locked hierarchy project");
        let before = migration::open_project(&created.root).expect("open empty project");
        let manifest_path = Path::new(&created.root).join(".writing-buddy/project.json");
        let before_manifest = fs::read(&manifest_path).expect("read manifest");
        let request = MaterializeOutlineHierarchyRequest {
            project_root: created.root.clone(),
            expected_project_revision: before.project_revision,
            journey_content: writable_hierarchy_fixture(&created.project_id, true),
            expected_journey_hash: String::new(),
        };

        assert_eq!(
            materialize_outline_hierarchy_on_disk(&request)
                .expect_err("locked hierarchy must not materialize"),
            "outlineHierarchyLocked"
        );
        assert_eq!(
            fs::read(manifest_path).expect("reread manifest"),
            before_manifest
        );
        assert!(
            !Path::new(&created.root)
                .join(CREATION_JOURNEY_RELATIVE_PATH)
                .exists()
        );
        let _ = fs::remove_dir_all(parent);
    }

    #[test]
    fn outline_hierarchy_rolls_back_chapters_when_story_write_fails() {
        let parent = project_creation_parent("outline-hierarchy-rollback");
        let mut create_request =
            project_creation_request(&parent, "Rollback Outline", "blank-longform");
        create_request.selected_initial_resources = vec!["first-volume".to_owned()];
        let created = create_project(create_request).expect("create rollback hierarchy project");
        let before = migration::open_project(&created.root).expect("open empty project");
        let manifest_path = Path::new(&created.root).join(".writing-buddy/project.json");
        let before_manifest = fs::read(&manifest_path).expect("read manifest");
        let story_path = Path::new(&created.root).join("story");
        fs::create_dir_all(&story_path).expect("create story directory");
        let scenes_path = story_path.join("scenes");
        if scenes_path.exists() {
            fs::remove_dir_all(&scenes_path).expect("remove scene directory");
        }
        fs::write(&scenes_path, b"not a directory").expect("block scene directory");
        let request = MaterializeOutlineHierarchyRequest {
            project_root: created.root.clone(),
            expected_project_revision: before.project_revision,
            journey_content: writable_hierarchy_fixture(&created.project_id, false),
            expected_journey_hash: String::new(),
        };

        assert_eq!(
            materialize_outline_hierarchy_on_disk(&request)
                .expect_err("story write must fail and roll back"),
            "outlineHierarchyWriteFailed"
        );
        assert_eq!(
            fs::read(manifest_path).expect("reread manifest"),
            before_manifest
        );
        assert_eq!(
            fs::read_dir(Path::new(&created.root).join("chapters"))
                .map(|entries| entries.count())
                .unwrap_or_default(),
            0
        );
        assert!(
            !Path::new(&created.root)
                .join(CREATION_JOURNEY_RELATIVE_PATH)
                .exists()
        );
        let _ = fs::remove_dir_all(parent);
    }
}
