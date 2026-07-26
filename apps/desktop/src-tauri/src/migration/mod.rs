use std::{
    collections::{HashMap, HashSet},
    fs,
    path::Path,
};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use walkdir::WalkDir;

use crate::filesystem;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SceneMetadata {
    #[serde(default)]
    pub location: String,
    #[serde(default)]
    pub time: String,
    #[serde(default)]
    pub pov: String,
    #[serde(default)]
    pub characters: Vec<String>,
    #[serde(default)]
    pub goal: String,
    #[serde(default)]
    pub note: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChapterDescriptor {
    pub id: String,
    pub title: String,
    pub file: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_words: Option<u64>,
    #[serde(default)]
    pub scene: SceneMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VolumeDescriptor {
    pub id: String,
    pub title: String,
    pub chapters: Vec<ChapterDescriptor>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WritingProject {
    pub schema_version: u64,
    pub project_id: String,
    pub title: String,
    pub volumes: Vec<VolumeDescriptor>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceDescriptor {
    pub id: String,
    pub r#type: String,
    pub title: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IntegrityIssue {
    pub severity: String,
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSnapshot {
    pub root: String,
    pub project: WritingProject,
    pub resources: Vec<ResourceDescriptor>,
    pub integrity_issues: Vec<IntegrityIssue>,
    pub word_counts: HashMap<String, usize>,
    pub read_only: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EarlyManifest {
    schema_version: u64,
    id: String,
    title: String,
}

fn stable_id(prefix: &str, seed: &str) -> String {
    let digest = hex::encode(Sha256::digest(seed.as_bytes()));
    format!("{prefix}-{}", &digest[..8])
}

fn is_stable_id(value: &str, prefix: &str) -> bool {
    value
        .strip_prefix(&format!("{prefix}-"))
        .is_some_and(|suffix| {
            suffix.len() == 8
                && suffix
                    .chars()
                    .all(|character| character.is_ascii_hexdigit())
        })
}

fn posix_relative(root: &Path, path: &Path) -> Result<String, String> {
    let relative = path
        .strip_prefix(root)
        .map_err(|_| "unsafePath".to_owned())?;
    let value = relative
        .components()
        .map(|component| component.as_os_str().to_string_lossy())
        .collect::<Vec<_>>()
        .join("/");
    filesystem::safe_relative_path(&value)?;
    Ok(value)
}

fn validate_current(project: &WritingProject) -> Vec<IntegrityIssue> {
    let mut issues = Vec::new();
    let mut ids = HashSet::new();
    let mut files = HashSet::new();
    if project.schema_version != 1 {
        issues.push(IntegrityIssue {
            severity: "error".to_owned(),
            code: "unsupportedSchema".to_owned(),
            message: format!("Unsupported project schema: {}", project.schema_version),
            path: None,
        });
    }
    if !is_stable_id(&project.project_id, "project") {
        issues.push(IntegrityIssue {
            severity: "error".to_owned(),
            code: "invalidProjectId".to_owned(),
            message: "The project ID does not match the current runtime contract.".to_owned(),
            path: None,
        });
    }
    for volume in &project.volumes {
        if !is_stable_id(&volume.id, "volume") || !ids.insert(volume.id.to_ascii_lowercase()) {
            issues.push(IntegrityIssue {
                severity: "error".to_owned(),
                code: "invalidOrDuplicateId".to_owned(),
                message: format!("Invalid or duplicate volume ID: {}", volume.id),
                path: None,
            });
        }
        for chapter in &volume.chapters {
            if !is_stable_id(&chapter.id, "chapter") || !ids.insert(chapter.id.to_ascii_lowercase())
            {
                issues.push(IntegrityIssue {
                    severity: "error".to_owned(),
                    code: "invalidOrDuplicateId".to_owned(),
                    message: format!("Invalid or duplicate chapter ID: {}", chapter.id),
                    path: Some(chapter.file.clone()),
                });
            }
            if filesystem::safe_relative_path(&chapter.file).is_err() {
                issues.push(IntegrityIssue {
                    severity: "error".to_owned(),
                    code: "unsafePath".to_owned(),
                    message: "A chapter path is unsafe.".to_owned(),
                    path: Some(chapter.file.clone()),
                });
            }
            if !files.insert(chapter.file.to_ascii_lowercase()) {
                issues.push(IntegrityIssue {
                    severity: "error".to_owned(),
                    code: "duplicateChapterFile".to_owned(),
                    message: "Multiple chapters point to the same file.".to_owned(),
                    path: Some(chapter.file.clone()),
                });
            }
        }
    }
    issues
}

fn read_title_from_json(path: &Path) -> Option<String> {
    let bytes = fs::read(path).ok()?;
    let value: serde_json::Value = serde_json::from_slice(&bytes).ok()?;
    value
        .get("name")
        .or_else(|| value.get("title"))
        .or_else(|| value.get("label"))
        .and_then(serde_json::Value::as_str)
        .map(ToOwned::to_owned)
}

fn collect_resources(root: &Path) -> Vec<ResourceDescriptor> {
    let references = root.join("references");
    if !references.exists() {
        return Vec::new();
    }
    let mut resources = Vec::new();
    for entry in WalkDir::new(&references)
        .follow_links(false)
        .into_iter()
        .filter_map(Result::ok)
    {
        if !entry.file_type().is_file() {
            continue;
        }
        let path = entry.path();
        let relative = match posix_relative(root, path) {
            Ok(value) => value,
            Err(_) => continue,
        };
        let lower = relative.to_ascii_lowercase();
        let kind = if lower.starts_with("references/characters/") && lower.ends_with(".json") {
            Some("character")
        } else if lower.starts_with("references/worldbuilding/")
            && lower.ends_with("/metadata.json")
        {
            Some("worldbuilding")
        } else if lower == "references/timeline.json" {
            Some("timeline")
        } else if lower.starts_with("references/items/") && lower.ends_with(".json") {
            Some("item")
        } else if lower.starts_with("references/notes/") && lower.ends_with(".md") {
            Some("note")
        } else {
            None
        };
        let Some(kind) = kind else { continue };
        let fallback = path
            .file_stem()
            .and_then(|value| value.to_str())
            .unwrap_or("resource");
        let title = if path.extension().and_then(|value| value.to_str()) == Some("json") {
            read_title_from_json(path).unwrap_or_else(|| fallback.to_owned())
        } else {
            fallback.to_owned()
        };
        let id_seed = if kind == "worldbuilding" {
            path.parent()
                .and_then(Path::file_name)
                .and_then(|value| value.to_str())
                .unwrap_or(fallback)
        } else {
            fallback
        };
        resources.push(ResourceDescriptor {
            id: id_seed.to_owned(),
            r#type: kind.to_owned(),
            title,
            path: relative,
        });
    }
    resources.sort_by(|left, right| {
        left.r#type
            .cmp(&right.r#type)
            .then(left.title.cmp(&right.title))
    });
    resources
}

fn count_words(content: &str) -> usize {
    let mut count = 0;
    let mut latin_word = false;
    for character in content.chars() {
        let code = character as u32;
        let is_cjk = (0x3400..=0x9fff).contains(&code)
            || (0x3040..=0x30ff).contains(&code)
            || (0xac00..=0xd7af).contains(&code);
        if is_cjk {
            count += 1;
            latin_word = false;
        } else if character.is_alphanumeric() {
            if !latin_word {
                count += 1;
                latin_word = true;
            }
        } else {
            latin_word = false;
        }
    }
    count
}

fn discover_early_project(root: &Path, manifest: EarlyManifest) -> Result<WritingProject, String> {
    if manifest.schema_version != 1 {
        return Err("unsupportedSchema".to_owned());
    }
    let volumes_root = root.join("volumes");
    let mut volumes = Vec::new();
    if volumes_root.exists() {
        let mut volume_paths = fs::read_dir(&volumes_root)
            .map_err(|_| "projectReadFailed".to_owned())?
            .filter_map(Result::ok)
            .filter(|entry| entry.file_type().is_ok_and(|kind| kind.is_dir()))
            .map(|entry| entry.path())
            .collect::<Vec<_>>();
        volume_paths.sort();
        for volume_path in volume_paths {
            let folder = volume_path
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("volume");
            let volume_json = volume_path.join("volume.json");
            let volume_value = fs::read(&volume_json)
                .ok()
                .and_then(|bytes| serde_json::from_slice::<serde_json::Value>(&bytes).ok());
            let volume_title = volume_value
                .as_ref()
                .and_then(|value| value.get("title"))
                .and_then(serde_json::Value::as_str)
                .unwrap_or(folder)
                .to_owned();
            let mut chapters = Vec::new();
            for entry in WalkDir::new(&volume_path)
                .max_depth(2)
                .follow_links(false)
                .into_iter()
                .filter_map(Result::ok)
            {
                if !entry.file_type().is_file()
                    || entry.path().extension().and_then(|value| value.to_str()) != Some("md")
                {
                    continue;
                }
                let file = posix_relative(root, entry.path())?;
                let stem = entry
                    .path()
                    .file_stem()
                    .and_then(|value| value.to_str())
                    .unwrap_or("chapter");
                let title = fs::read_to_string(entry.path())
                    .ok()
                    .and_then(|content| {
                        content
                            .lines()
                            .find_map(|line| line.strip_prefix("# ").map(str::to_owned))
                    })
                    .unwrap_or_else(|| stem.to_owned());
                chapters.push(ChapterDescriptor {
                    id: stable_id("chapter", &file),
                    title,
                    file,
                    status: None,
                    target_words: None,
                    scene: SceneMetadata::default(),
                });
            }
            chapters.sort_by(|left, right| left.file.cmp(&right.file));
            volumes.push(VolumeDescriptor {
                id: stable_id("volume", folder),
                title: volume_title,
                chapters,
            });
        }
    }
    Ok(WritingProject {
        schema_version: 1,
        project_id: stable_id("project", &manifest.id),
        title: manifest.title,
        volumes,
    })
}

pub fn open_project(project_root: &str) -> Result<ProjectSnapshot, String> {
    let root = filesystem::canonical_project_root(project_root)?;
    let current_path = root.join(".writing-buddy").join("project.json");
    let early_path = root.join("project.json");
    let (project, mut issues, read_only) = if current_path.exists() {
        let bytes = fs::read(&current_path).map_err(|_| "manifestReadFailed".to_owned())?;
        let project: WritingProject =
            serde_json::from_slice(&bytes).map_err(|_| "invalidManifest".to_owned())?;
        let issues = validate_current(&project);
        let read_only = issues.iter().any(|issue| issue.severity == "error");
        (project, issues, read_only)
    } else if early_path.exists() {
        let bytes = fs::read(&early_path).map_err(|_| "manifestReadFailed".to_owned())?;
        let manifest: EarlyManifest =
            serde_json::from_slice(&bytes).map_err(|_| "invalidManifest".to_owned())?;
        let project = discover_early_project(&root, manifest)?;
        let issues = vec![IntegrityIssue {
            severity: "warning".to_owned(),
            code: "earlyDirectorySchema".to_owned(),
            message:
                "Early directory projects remain read-only until copied and explicitly migrated."
                    .to_owned(),
            path: Some("project.json".to_owned()),
        }];
        (project, issues, true)
    } else {
        return Err("manifestNotFound".to_owned());
    };

    let mut word_counts = HashMap::new();
    for chapter in project.volumes.iter().flat_map(|volume| &volume.chapters) {
        match filesystem::read_text(project_root, &chapter.file) {
            Ok(file) => {
                word_counts.insert(chapter.id.clone(), count_words(&file.content));
            }
            Err(_) => issues.push(IntegrityIssue {
                severity: "error".to_owned(),
                code: "missingChapterFile".to_owned(),
                message: "The chapter file is missing or unreadable.".to_owned(),
                path: Some(chapter.file.clone()),
            }),
        }
    }
    let read_only = read_only || issues.iter().any(|issue| issue.severity == "error");
    Ok(ProjectSnapshot {
        root: root.to_string_lossy().into_owned(),
        project,
        resources: collect_resources(&root),
        integrity_issues: issues,
        word_counts,
        read_only,
    })
}
