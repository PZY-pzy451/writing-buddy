use tauri::{AppHandle, Manager, State, ipc::Channel};

use crate::{
    AppState,
    ai::{
        AiBalance, AiConnectionTestResult, AiGenerateRequest, AiModel, AiProviderPreferences,
        AiProviderStatus, AiStreamEvent, AiUsageSummary, PROVIDER_ID, SecretStatus,
        errors::{AiErrorCode, PublicAiError},
        provider::deepseek::DeepSeekClient,
        provider_definition, runtime,
        storage::AiStorage,
    },
    secrets,
};

fn storage(app: &AppHandle) -> Result<AiStorage, PublicAiError> {
    app.path()
        .app_data_dir()
        .map(AiStorage::new)
        .map_err(|_| PublicAiError::new(AiErrorCode::InvalidConfiguration))
}

fn secret() -> Result<secrets::SecretValue, PublicAiError> {
    secrets::get("deepseek-api-key")
        .map_err(|_| PublicAiError::new(AiErrorCode::SecretStoreFailed))?
        .ok_or_else(|| PublicAiError::new(AiErrorCode::AuthenticationFailed))
}

fn secret_is_configured() -> Result<bool, PublicAiError> {
    secrets::get("deepseek-api-key")
        .map(|value| value.is_some())
        .map_err(|_| PublicAiError::new(AiErrorCode::SecretStoreFailed))
}

fn status(app: &AppHandle) -> Result<AiProviderStatus, PublicAiError> {
    let storage = storage(app)?;
    Ok(AiProviderStatus {
        provider: provider_definition(),
        secret: storage.secret_status(secret_is_configured()?),
        preferences: storage.preferences(),
        last_validated_at: storage.last_validated_at(),
    })
}

#[tauri::command]
pub fn ai_get_provider_status(app: AppHandle) -> Result<AiProviderStatus, PublicAiError> {
    status(&app)
}

#[tauri::command]
pub fn ai_save_deepseek_key(app: AppHandle, key: String) -> Result<SecretStatus, PublicAiError> {
    let trimmed = key.trim();
    if trimmed.is_empty() || trimmed.len() > 16_384 {
        return Err(PublicAiError::new(AiErrorCode::InvalidConfiguration));
    }
    secrets::set("deepseek-api-key", trimmed)
        .map_err(|_| PublicAiError::new(AiErrorCode::SecretStoreFailed))?;
    storage(&app)?.mark_secret_saved(trimmed)
}

#[tauri::command]
pub fn ai_delete_deepseek_key(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<SecretStatus, PublicAiError> {
    state
        .ai_jobs
        .lock()
        .map_err(|_| PublicAiError::new(AiErrorCode::Unknown))?
        .cancel_all();
    secrets::delete("deepseek-api-key")
        .map_err(|_| PublicAiError::new(AiErrorCode::SecretStoreFailed))?;
    let storage = storage(&app)?;
    storage.clear_provider_cache();
    storage.mark_secret_deleted()
}

#[tauri::command]
pub async fn ai_test_deepseek_connection(
    app: AppHandle,
) -> Result<AiConnectionTestResult, PublicAiError> {
    let storage = storage(&app)?;
    let preferences = storage.preferences();
    let key = secret()?;
    let client = DeepSeekClient::new(preferences.connection_timeout_ms)?;
    let (models, balance) = tokio::join!(client.list_models(&key), client.get_balance(&key));
    let models = storage.save_models(models?)?;
    let balance = balance?;
    let validated_at = storage.mark_validated()?;
    Ok(AiConnectionTestResult {
        status: AiProviderStatus {
            provider: provider_definition(),
            secret: storage.secret_status(true),
            preferences,
            last_validated_at: Some(validated_at),
        },
        models,
        balance,
    })
}

#[tauri::command]
pub async fn ai_list_deepseek_models(
    app: AppHandle,
    force_refresh: bool,
) -> Result<Vec<AiModel>, PublicAiError> {
    let storage = storage(&app)?;
    if !force_refresh && let Some(models) = storage.cached_models() {
        return Ok(models);
    }
    let preferences = storage.preferences();
    let key = secret()?;
    let models = DeepSeekClient::new(preferences.connection_timeout_ms)?
        .list_models(&key)
        .await?;
    storage.save_models(models)
}

#[tauri::command]
pub async fn ai_get_deepseek_balance(app: AppHandle) -> Result<AiBalance, PublicAiError> {
    let storage = storage(&app)?;
    let preferences = storage.preferences();
    let key = secret()?;
    DeepSeekClient::new(preferences.connection_timeout_ms)?
        .get_balance(&key)
        .await
}

#[tauri::command]
pub fn ai_get_preferences(app: AppHandle) -> Result<AiProviderPreferences, PublicAiError> {
    Ok(storage(&app)?.preferences())
}

#[tauri::command]
pub fn ai_save_preferences(
    app: AppHandle,
    preferences: AiProviderPreferences,
) -> Result<AiProviderPreferences, PublicAiError> {
    storage(&app)?.save_preferences(preferences)
}

#[tauri::command]
pub fn ai_start_generation(
    app: AppHandle,
    state: State<'_, AppState>,
    request: AiGenerateRequest,
    on_event: Channel<AiStreamEvent>,
) -> Result<(), PublicAiError> {
    request.validate()?;
    if request.provider_id != PROVIDER_ID {
        return Err(PublicAiError::new(AiErrorCode::InvalidConfiguration));
    }
    let storage = storage(&app)?;
    let preferences = storage.preferences();
    let key = secret()?;
    let job_id = request.job_id.clone();
    let cancellation = state
        .ai_jobs
        .lock()
        .map_err(|_| PublicAiError::new(AiErrorCode::Unknown))?
        .start(job_id.clone());
    let app_for_cleanup = app.clone();
    tauri::async_runtime::spawn(async move {
        runtime::run_generation(request, preferences, key, cancellation, on_event, storage).await;
        if let Some(state) = app_for_cleanup.try_state::<AppState>()
            && let Ok(mut jobs) = state.ai_jobs.lock()
        {
            jobs.finish(&job_id);
        }
    });
    Ok(())
}

#[tauri::command]
pub fn ai_cancel_job(state: State<'_, AppState>, job_id: String) -> Result<bool, PublicAiError> {
    state
        .ai_jobs
        .lock()
        .map(|mut jobs| jobs.cancel(&job_id))
        .map_err(|_| PublicAiError::new(AiErrorCode::Unknown))
}

#[tauri::command]
pub fn ai_get_usage_summary(app: AppHandle) -> Result<AiUsageSummary, PublicAiError> {
    Ok(storage(&app)?.usage_summary())
}
