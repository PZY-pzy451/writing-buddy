use std::{
    fs::{self, OpenOptions},
    io::{BufRead, BufReader, Write},
    path::{Path, PathBuf},
};

use chrono::{DateTime, Datelike, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::{
    ai::{
        AiModel, AiProviderPreferences, AiUsage, AiUsageSummary, PROVIDER_ID, SecretStatus,
        errors::{AiErrorCode, PublicAiError},
    },
    filesystem,
};

const MAX_SETTINGS_BYTES: u64 = 1024 * 1024;
const MODEL_CACHE_TTL_HOURS: i64 = 24;

#[derive(Clone)]
pub struct AiStorage {
    app_data_dir: PathBuf,
}

impl AiStorage {
    pub fn new(app_data_dir: PathBuf) -> Self {
        Self { app_data_dir }
    }

    pub fn preferences(&self) -> AiProviderPreferences {
        self.settings()
            .preferences
            .validate_and_normalize()
            .unwrap_or_default()
    }

    pub fn save_preferences(
        &self,
        preferences: AiProviderPreferences,
    ) -> Result<AiProviderPreferences, PublicAiError> {
        let normalized = preferences.validate_and_normalize()?;
        let mut settings = self.settings();
        settings.preferences = normalized.clone();
        self.write_settings(&settings)?;
        Ok(normalized)
    }

    pub fn secret_status(&self, configured: bool) -> SecretStatus {
        let metadata = self.settings().metadata;
        SecretStatus {
            configured,
            provider_id: PROVIDER_ID,
            updated_at: configured.then_some(metadata.secret_updated_at).flatten(),
            fingerprint: configured.then_some(metadata.fingerprint).flatten(),
        }
    }

    pub fn mark_secret_saved(&self, key: &str) -> Result<SecretStatus, PublicAiError> {
        let mut settings = self.settings();
        settings.metadata.secret_updated_at = Some(Utc::now().to_rfc3339());
        settings.metadata.fingerprint = Some(fingerprint(key));
        settings.metadata.last_validated_at = None;
        self.write_settings(&settings)?;
        Ok(self.secret_status(true))
    }

    pub fn mark_secret_deleted(&self) -> Result<SecretStatus, PublicAiError> {
        let mut settings = self.settings();
        settings.metadata = ProviderMetadata::default();
        self.write_settings(&settings)?;
        Ok(self.secret_status(false))
    }

    pub fn last_validated_at(&self) -> Option<String> {
        self.settings().metadata.last_validated_at
    }

    pub fn mark_validated(&self) -> Result<String, PublicAiError> {
        let mut settings = self.settings();
        let timestamp = Utc::now().to_rfc3339();
        settings.metadata.last_validated_at = Some(timestamp.clone());
        self.write_settings(&settings)?;
        Ok(timestamp)
    }

    pub fn cached_models(&self) -> Option<Vec<AiModel>> {
        let cache = read_json::<ModelCache>(&self.model_cache_path())?;
        let fetched_at = DateTime::parse_from_rfc3339(&cache.fetched_at)
            .ok()?
            .with_timezone(&Utc);
        (Utc::now().signed_duration_since(fetched_at).num_hours() < MODEL_CACHE_TTL_HOURS)
            .then_some(cache.models)
    }

    pub fn save_models(&self, models: Vec<AiModel>) -> Result<Vec<AiModel>, PublicAiError> {
        write_json(
            &self.model_cache_path(),
            &ModelCache {
                fetched_at: Utc::now().to_rfc3339(),
                models: models.clone(),
            },
        )?;
        Ok(models)
    }

    pub fn clear_provider_cache(&self) {
        let _ = fs::remove_file(self.model_cache_path());
    }

    pub fn append_usage(&self, record: &AiUsageRecord) -> Result<(), PublicAiError> {
        let path = self.usage_path(Utc::now());
        let parent = path
            .parent()
            .ok_or_else(|| PublicAiError::new(AiErrorCode::Unknown))?;
        fs::create_dir_all(parent).map_err(|_| PublicAiError::new(AiErrorCode::Unknown))?;
        let line =
            serde_json::to_string(record).map_err(|_| PublicAiError::new(AiErrorCode::Unknown))?;
        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(path)
            .map_err(|_| PublicAiError::new(AiErrorCode::Unknown))?;
        writeln!(file, "{line}").map_err(|_| PublicAiError::new(AiErrorCode::Unknown))
    }

    pub fn usage_summary(&self) -> AiUsageSummary {
        let path = self.usage_path(Utc::now());
        let Ok(file) = fs::File::open(path) else {
            return AiUsageSummary::default();
        };
        BufReader::new(file)
            .lines()
            .map_while(Result::ok)
            .filter_map(|line| serde_json::from_str::<AiUsageRecord>(&line).ok())
            .fold(AiUsageSummary::default(), |mut summary, record| {
                summary.input_tokens += record.usage.input_tokens.unwrap_or_default();
                summary.output_tokens += record.usage.output_tokens.unwrap_or_default();
                summary.total_tokens += record.usage.total_tokens.unwrap_or_else(|| {
                    record.usage.input_tokens.unwrap_or_default()
                        + record.usage.output_tokens.unwrap_or_default()
                });
                summary.requests += 1;
                summary
            })
    }

    fn usage_path(&self, timestamp: DateTime<Utc>) -> PathBuf {
        self.app_data_dir.join("ai").join("usage").join(format!(
            "{:04}-{:02}.jsonl",
            timestamp.year(),
            timestamp.month()
        ))
    }

    fn settings(&self) -> AiSettingsDocument {
        read_json::<AiSettingsDocument>(&self.settings_path()).unwrap_or_default()
    }

    fn write_settings(&self, settings: &AiSettingsDocument) -> Result<(), PublicAiError> {
        write_json(&self.settings_path(), settings)
    }

    fn settings_path(&self) -> PathBuf {
        self.app_data_dir.join("settings").join("ai.json")
    }

    fn model_cache_path(&self) -> PathBuf {
        self.app_data_dir
            .join("ai")
            .join("provider-model-cache.json")
    }
}

#[derive(Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct AiSettingsDocument {
    #[serde(default)]
    preferences: AiProviderPreferences,
    #[serde(default)]
    metadata: ProviderMetadata,
}

#[derive(Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProviderMetadata {
    secret_updated_at: Option<String>,
    fingerprint: Option<String>,
    last_validated_at: Option<String>,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ModelCache {
    fetched_at: String,
    models: Vec<AiModel>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiUsageRecord {
    pub timestamp: String,
    pub provider_id: String,
    pub model_id: String,
    pub job_type: String,
    pub duration_ms: u64,
    pub status: String,
    #[serde(flatten)]
    pub usage: AiUsage,
}

fn fingerprint(key: &str) -> String {
    let hash = hex::encode_upper(Sha256::digest(key.as_bytes()));
    format!("{}…", &hash[..8])
}

fn read_json<T: for<'de> Deserialize<'de>>(path: &Path) -> Option<T> {
    let metadata = fs::metadata(path).ok()?;
    if metadata.len() > MAX_SETTINGS_BYTES {
        return None;
    }
    serde_json::from_slice(&fs::read(path).ok()?).ok()
}

fn write_json<T: Serialize>(path: &Path, value: &T) -> Result<(), PublicAiError> {
    let bytes =
        serde_json::to_vec_pretty(value).map_err(|_| PublicAiError::new(AiErrorCode::Unknown))?;
    filesystem::write_bytes_atomic(path, &bytes)
        .map_err(|_| PublicAiError::new(AiErrorCode::Unknown))
}

#[cfg(test)]
mod tests {
    use std::{
        fs,
        time::{SystemTime, UNIX_EPOCH},
    };

    use super::{AiStorage, AiUsageRecord};
    use crate::ai::{AiProviderPreferences, AiUsage, DEFAULT_MODEL_ID};

    fn temp_storage() -> (std::path::PathBuf, AiStorage) {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "writing-buddy-ai-storage-{}-{nonce}",
            std::process::id()
        ));
        (root.clone(), AiStorage::new(root))
    }

    #[test]
    fn preferences_and_status_never_store_the_key() {
        let (root, storage) = temp_storage();
        let saved = storage
            .save_preferences(AiProviderPreferences::default())
            .expect("save preferences");
        assert_eq!(saved.default_model_id.as_deref(), Some(DEFAULT_MODEL_ID));
        storage
            .mark_secret_saved("fixture-key-value")
            .expect("save status");
        let files = [
            root.join("settings").join("ai.json"),
            root.join("ai").join("provider-model-cache.json"),
        ]
        .into_iter()
        .filter_map(|path| fs::read_to_string(path).ok())
        .collect::<String>();
        assert!(!files.contains("fixture-key-value"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn usage_summary_contains_only_aggregate_metadata() {
        let (root, storage) = temp_storage();
        storage
            .append_usage(&AiUsageRecord {
                timestamp: chrono::Utc::now().to_rfc3339(),
                provider_id: "deepseek".to_owned(),
                model_id: DEFAULT_MODEL_ID.to_owned(),
                job_type: "storyforge-test".to_owned(),
                duration_ms: 12,
                status: "completed".to_owned(),
                usage: AiUsage {
                    input_tokens: Some(3),
                    output_tokens: Some(5),
                    total_tokens: Some(8),
                    cached_input_tokens: Some(1),
                },
            })
            .expect("append usage");
        let summary = storage.usage_summary();
        assert_eq!(summary.total_tokens, 8);
        assert_eq!(summary.requests, 1);
        let _ = fs::remove_dir_all(root);
    }
}
