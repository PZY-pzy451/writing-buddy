use std::{
    collections::{BTreeMap, BTreeSet, HashMap},
    fs,
    path::{Path, PathBuf},
};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use walkdir::WalkDir;

use crate::filesystem;

pub const STORY_INDEX_SCHEMA_VERSION: u32 = 1;
pub const STORY_INDEX_RELATIVE_PATH: &str = ".writing-buddy/cache/story-index-v1.json";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct IndexRecord {
    pub id: String,
    pub kind: String,
    pub revision: u64,
    pub chapter_id: Option<String>,
    pub scene_id: Option<String>,
    pub participant_ids: Vec<String>,
    pub related_resource_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StoryIndexSnapshot {
    pub schema_version: u32,
    pub source_fingerprint: String,
    pub records: Vec<IndexRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StoryIndexStats {
    pub schema_version: u32,
    pub ready: bool,
    pub source_fingerprint: String,
    pub record_count: usize,
    pub kind_counts: BTreeMap<String, usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct IndexQuery {
    pub kind: Option<String>,
    pub chapter_id: Option<String>,
    pub participant_id: Option<String>,
    pub related_resource_id: Option<String>,
    #[serde(default)]
    pub offset: usize,
    #[serde(default)]
    pub limit: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct IndexQueryResult {
    pub ids: Vec<String>,
    pub total: usize,
    pub offset: usize,
    pub limit: usize,
    pub source_fingerprint: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum IndexMutation {
    Upsert(IndexRecord),
    Remove(String),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct IndexChangeSet {
    pub upserted: usize,
    pub removed: usize,
    pub source_fingerprint: String,
}

#[derive(Debug, Clone, Default)]
pub struct StoryIndex {
    records: BTreeMap<String, IndexRecord>,
    by_kind: HashMap<String, BTreeSet<String>>,
    by_chapter: HashMap<String, BTreeSet<String>>,
    by_participant: HashMap<String, BTreeSet<String>>,
    by_related_resource: HashMap<String, BTreeSet<String>>,
    fingerprint: u64,
}

fn normalize_record(mut record: IndexRecord) -> IndexRecord {
    record.id = record.id.trim().to_owned();
    record.kind = record.kind.trim().to_owned();
    record.chapter_id = record
        .chapter_id
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty());
    record.scene_id = record
        .scene_id
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty());
    record
        .participant_ids
        .retain(|value| !value.trim().is_empty());
    record
        .related_resource_ids
        .retain(|value| !value.trim().is_empty() && value != &record.id);
    record.participant_ids.sort();
    record.participant_ids.dedup();
    record.related_resource_ids.sort();
    record.related_resource_ids.dedup();
    record
}

fn hash_bytes(mut current: u64, bytes: &[u8]) -> u64 {
    for byte in bytes {
        current ^= u64::from(*byte);
        current = current.wrapping_mul(1_099_511_628_211);
    }
    current
}

fn record_fingerprint(record: &IndexRecord) -> u64 {
    let mut value = 14_695_981_039_346_656_037;
    for part in [
        record.id.as_str(),
        record.kind.as_str(),
        record.chapter_id.as_deref().unwrap_or_default(),
        record.scene_id.as_deref().unwrap_or_default(),
    ] {
        value = hash_bytes(value, part.as_bytes());
        value = hash_bytes(value, &[0xff]);
    }
    value = hash_bytes(value, &record.revision.to_le_bytes());
    for part in record
        .participant_ids
        .iter()
        .chain(record.related_resource_ids.iter())
    {
        value = hash_bytes(value, part.as_bytes());
        value = hash_bytes(value, &[0xfe]);
    }
    value
}

fn add_to_map(map: &mut HashMap<String, BTreeSet<String>>, key: &str, id: &str) {
    map.entry(key.to_owned()).or_default().insert(id.to_owned());
}

fn remove_from_map(map: &mut HashMap<String, BTreeSet<String>>, key: &str, id: &str) {
    if let Some(ids) = map.get_mut(key) {
        ids.remove(id);
        if ids.is_empty() {
            map.remove(key);
        }
    }
}

impl StoryIndex {
    pub fn rebuild(records: Vec<IndexRecord>) -> Self {
        let mut index = Self::default();
        index.apply(
            &records
                .into_iter()
                .map(IndexMutation::Upsert)
                .collect::<Vec<_>>(),
        );
        index
    }

    pub fn from_snapshot(snapshot: StoryIndexSnapshot) -> Result<Self, String> {
        if snapshot.schema_version != STORY_INDEX_SCHEMA_VERSION {
            return Err("storyIndexVersionUnsupported".to_owned());
        }
        let expected = snapshot.source_fingerprint;
        let index = Self::rebuild(snapshot.records);
        if index.source_fingerprint() != expected {
            return Err("storyIndexChecksumMismatch".to_owned());
        }
        Ok(index)
    }

    pub fn snapshot(&self) -> StoryIndexSnapshot {
        StoryIndexSnapshot {
            schema_version: STORY_INDEX_SCHEMA_VERSION,
            source_fingerprint: self.source_fingerprint(),
            records: self.records.values().cloned().collect(),
        }
    }

    pub fn source_fingerprint(&self) -> String {
        format!("{:016x}", self.fingerprint)
    }

    pub fn stats(&self) -> StoryIndexStats {
        StoryIndexStats {
            schema_version: STORY_INDEX_SCHEMA_VERSION,
            ready: true,
            source_fingerprint: self.source_fingerprint(),
            record_count: self.records.len(),
            kind_counts: self
                .by_kind
                .iter()
                .map(|(kind, records)| (kind.clone(), records.len()))
                .collect(),
        }
    }

    fn add_record(&mut self, record: IndexRecord) {
        let record = normalize_record(record);
        if record.id.is_empty() || record.kind.is_empty() {
            return;
        }
        if let Some(previous) = self.records.remove(&record.id) {
            self.remove_reverse_links(&previous);
            self.fingerprint ^= record_fingerprint(&previous);
        }
        add_to_map(&mut self.by_kind, &record.kind, &record.id);
        if let Some(chapter_id) = &record.chapter_id {
            add_to_map(&mut self.by_chapter, chapter_id, &record.id);
        }
        for participant_id in &record.participant_ids {
            add_to_map(&mut self.by_participant, participant_id, &record.id);
        }
        for resource_id in &record.related_resource_ids {
            add_to_map(&mut self.by_related_resource, resource_id, &record.id);
        }
        self.fingerprint ^= record_fingerprint(&record);
        self.records.insert(record.id.clone(), record);
    }

    fn remove_reverse_links(&mut self, record: &IndexRecord) {
        remove_from_map(&mut self.by_kind, &record.kind, &record.id);
        if let Some(chapter_id) = &record.chapter_id {
            remove_from_map(&mut self.by_chapter, chapter_id, &record.id);
        }
        for participant_id in &record.participant_ids {
            remove_from_map(&mut self.by_participant, participant_id, &record.id);
        }
        for resource_id in &record.related_resource_ids {
            remove_from_map(&mut self.by_related_resource, resource_id, &record.id);
        }
    }

    pub fn apply(&mut self, mutations: &[IndexMutation]) -> IndexChangeSet {
        let mut upserted = 0;
        let mut removed = 0;
        for mutation in mutations {
            match mutation {
                IndexMutation::Upsert(record) => {
                    self.add_record(record.clone());
                    upserted += 1;
                }
                IndexMutation::Remove(id) => {
                    if let Some(previous) = self.records.remove(id) {
                        self.remove_reverse_links(&previous);
                        self.fingerprint ^= record_fingerprint(&previous);
                        removed += 1;
                    }
                }
            }
        }
        IndexChangeSet {
            upserted,
            removed,
            source_fingerprint: self.source_fingerprint(),
        }
    }

    fn candidates_for_query(&self, query: &IndexQuery) -> Vec<&BTreeSet<String>> {
        let mut candidates = Vec::new();
        if let Some(kind) = &query.kind {
            if let Some(ids) = self.by_kind.get(kind) {
                candidates.push(ids);
            } else {
                return Vec::new();
            }
        }
        if let Some(chapter_id) = &query.chapter_id {
            if let Some(ids) = self.by_chapter.get(chapter_id) {
                candidates.push(ids);
            } else {
                return Vec::new();
            }
        }
        if let Some(participant_id) = &query.participant_id {
            if let Some(ids) = self.by_participant.get(participant_id) {
                candidates.push(ids);
            } else {
                return Vec::new();
            }
        }
        if let Some(resource_id) = &query.related_resource_id {
            if let Some(ids) = self.by_related_resource.get(resource_id) {
                candidates.push(ids);
            } else {
                return Vec::new();
            }
        }
        candidates.sort_by_key(|ids| ids.len());
        candidates
    }

    fn matches_query(&self, id: &str, query: &IndexQuery) -> bool {
        let Some(record) = self.records.get(id) else {
            return false;
        };
        query.kind.as_ref().is_none_or(|kind| &record.kind == kind)
            && query
                .chapter_id
                .as_ref()
                .is_none_or(|chapter_id| record.chapter_id.as_ref() == Some(chapter_id))
            && query
                .participant_id
                .as_ref()
                .is_none_or(|participant_id| record.participant_ids.contains(participant_id))
            && query
                .related_resource_id
                .as_ref()
                .is_none_or(|resource_id| record.related_resource_ids.contains(resource_id))
    }

    pub fn query(&self, query: &IndexQuery) -> IndexQueryResult {
        let candidates = self.candidates_for_query(query);
        let source: Box<dyn Iterator<Item = &String> + '_> =
            if let Some(smallest) = candidates.first() {
                Box::new(smallest.iter())
            } else if query.kind.is_some()
                || query.chapter_id.is_some()
                || query.participant_id.is_some()
                || query.related_resource_id.is_some()
            {
                Box::new([].iter())
            } else {
                Box::new(self.records.keys())
            };
        let matched = source
            .filter(|id| self.matches_query(id, query))
            .collect::<Vec<_>>();
        let offset = query.offset.min(matched.len());
        let limit = if query.limit == 0 {
            200
        } else {
            query.limit.min(5_000)
        };
        IndexQueryResult {
            ids: matched
                .iter()
                .skip(offset)
                .take(limit)
                .map(|id| (*id).clone())
                .collect(),
            total: matched.len(),
            offset,
            limit,
            source_fingerprint: self.source_fingerprint(),
        }
    }
}

fn canonical_chapter_id(value: &str) -> String {
    if value.starts_with("chapter:") {
        value.to_owned()
    } else {
        format!("chapter:{value}")
    }
}

fn value_at_path<'a>(value: &'a Value, paths: &[&[&str]]) -> Option<&'a str> {
    paths.iter().find_map(|path| {
        path.iter()
            .try_fold(value, |current, key| current.get(*key))
            .and_then(Value::as_str)
    })
}

fn collect_related_ids(value: &Value, key: Option<&str>, ids: &mut Vec<String>) {
    match value {
        Value::Object(object) => {
            for (child_key, child) in object {
                collect_related_ids(child, Some(child_key), ids);
            }
        }
        Value::Array(values) => {
            for child in values {
                collect_related_ids(child, key, ids);
            }
        }
        Value::String(text)
            if key.is_some_and(|name| name.ends_with("Id") || name.ends_with("Ids"))
                && text.contains(':') =>
        {
            ids.push(text.clone());
        }
        _ => {}
    }
}

fn fallback_kind(path: &Path) -> &str {
    let normalized = path.to_string_lossy().replace('\\', "/");
    if normalized.contains("/mentions/") {
        "mention"
    } else if normalized.contains("/states/") {
        "state"
    } else {
        "resource"
    }
}

pub fn index_record_from_value(value: &Value, fallback: &str) -> Option<IndexRecord> {
    let id = value.get("id")?.as_str()?.trim();
    if id.is_empty() {
        return None;
    }
    let kind = value
        .get("type")
        .and_then(Value::as_str)
        .unwrap_or(fallback)
        .trim();
    if kind.is_empty() {
        return None;
    }
    let chapter_id = value_at_path(
        value,
        &[
            &["chapterId"],
            &["narrativePosition", "chapterId"],
            &["effectiveFrom", "chapterId"],
        ],
    )
    .map(canonical_chapter_id);
    let scene_id = value_at_path(
        value,
        &[
            &["sceneId"],
            &["narrativePosition", "sceneId"],
            &["effectiveFrom", "sceneId"],
        ],
    )
    .map(str::to_owned);
    let mut participant_ids = value
        .get("participantIds")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(Value::as_str)
        .map(str::to_owned)
        .collect::<Vec<_>>();
    for key in ["characterId", "sourceCharacterId", "targetCharacterId"] {
        if let Some(id) = value.get(key).and_then(Value::as_str) {
            participant_ids.push(id.to_owned());
        }
    }
    if let Some(subject) = value.get("subject").and_then(Value::as_str)
        && subject.starts_with("character:")
    {
        participant_ids.push(subject.to_owned());
    }
    let mut related_resource_ids = Vec::new();
    collect_related_ids(value, None, &mut related_resource_ids);
    Some(normalize_record(IndexRecord {
        id: id.to_owned(),
        kind: kind.to_owned(),
        revision: value.get("revision").and_then(Value::as_u64).unwrap_or(0),
        chapter_id,
        scene_id,
        participant_ids,
        related_resource_ids,
    }))
}

fn project_manifest_records(root: &Path) -> Result<Vec<IndexRecord>, String> {
    let manifest_path = root.join(".writing-buddy").join("project.json");
    let bytes = fs::read(manifest_path).map_err(|_| "storyIndexManifestReadFailed".to_owned())?;
    let manifest: Value =
        serde_json::from_slice(&bytes).map_err(|_| "storyIndexManifestInvalid".to_owned())?;
    let mut records = Vec::new();
    for volume in manifest
        .get("volumes")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
    {
        for chapter in volume
            .get("chapters")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
        {
            let Some(id) = chapter.get("id").and_then(Value::as_str) else {
                continue;
            };
            records.push(IndexRecord {
                id: canonical_chapter_id(id),
                kind: "chapter".to_owned(),
                revision: 0,
                chapter_id: None,
                scene_id: None,
                participant_ids: Vec::new(),
                related_resource_ids: Vec::new(),
            });
        }
    }
    Ok(records)
}

fn story_file_records(path: &Path) -> Result<Vec<IndexRecord>, String> {
    let bytes = fs::read(path).map_err(|_| "storyIndexSourceReadFailed".to_owned())?;
    let value: Value =
        serde_json::from_slice(&bytes).map_err(|_| "storyIndexSourceInvalid".to_owned())?;
    let fallback = fallback_kind(path);
    Ok(match value {
        Value::Array(values) => values
            .iter()
            .filter_map(|value| index_record_from_value(value, fallback))
            .collect(),
        value => index_record_from_value(&value, fallback)
            .into_iter()
            .collect(),
    })
}

pub fn rebuild_project_index(project_root: &str) -> Result<(PathBuf, StoryIndex), String> {
    let root = filesystem::canonical_project_root(project_root)?;
    let mut records = project_manifest_records(&root)?;
    let story_root = root.join("story");
    if story_root.exists() {
        for entry in WalkDir::new(&story_root).follow_links(false) {
            let entry = entry.map_err(|_| "storyIndexScanFailed".to_owned())?;
            if !entry.file_type().is_file()
                || entry.path().extension().and_then(|value| value.to_str()) != Some("json")
            {
                continue;
            }
            records.extend(story_file_records(entry.path())?);
        }
    }
    Ok((root, StoryIndex::rebuild(records)))
}

pub fn persist_project_index(root: &Path, index: &StoryIndex) -> Result<(), String> {
    let target = root.join(STORY_INDEX_RELATIVE_PATH);
    let mut bytes = serde_json::to_vec(&index.snapshot())
        .map_err(|_| "storyIndexSerializeFailed".to_owned())?;
    bytes.push(b'\n');
    filesystem::write_bytes_atomic(&target, &bytes)
}

pub fn load_project_index(project_root: &str) -> Result<(PathBuf, StoryIndex), String> {
    let root = filesystem::canonical_project_root(project_root)?;
    let target = root.join(STORY_INDEX_RELATIVE_PATH);
    let bytes = fs::read(target).map_err(|_| "storyIndexNotFound".to_owned())?;
    let snapshot: StoryIndexSnapshot =
        serde_json::from_slice(&bytes).map_err(|_| "storyIndexInvalid".to_owned())?;
    Ok((root, StoryIndex::from_snapshot(snapshot)?))
}

pub fn remove_project_index(root: &Path) -> Result<(), String> {
    let target = root.join(STORY_INDEX_RELATIVE_PATH);
    if target.exists() {
        fs::remove_file(target).map_err(|_| "storyIndexRemoveFailed".to_owned())?;
    }
    Ok(())
}
