use std::time::{Duration, Instant as StdInstant};

use chrono::Utc;
use futures_util::StreamExt;
use tauri::ipc::Channel;
use tokio::time::{Instant, timeout};
use tokio_util::sync::CancellationToken;

use crate::{
    ai::{
        AiGenerateRequest, AiProviderPreferences, AiStreamEvent, AiUsage,
        errors::{AiErrorCode, PublicAiError},
        provider::deepseek::{DeepSeekClient, ParsedChunk, parse_stream_json},
        sse_parser::{SseDecoder, SseFrame},
        storage::{AiStorage, AiUsageRecord},
    },
    secrets::SecretValue,
};

const HARD_JOB_LIMIT: Duration = Duration::from_secs(10 * 60);
const DELTA_FLUSH_INTERVAL: Duration = Duration::from_millis(40);
const DELTA_FLUSH_CHARS: usize = 48;

pub async fn run_generation(
    request: AiGenerateRequest,
    preferences: AiProviderPreferences,
    key: SecretValue,
    cancellation: CancellationToken,
    channel: Channel<AiStreamEvent>,
    storage: AiStorage,
) {
    let started_at = StdInstant::now();
    let hard_deadline = Instant::now() + HARD_JOB_LIMIT;
    send(
        &channel,
        AiStreamEvent::JobStarted {
            job_id: request.job_id.clone(),
        },
    );
    let mut retry_count = 0_u8;

    loop {
        if Instant::now() >= hard_deadline {
            send(
                &channel,
                AiStreamEvent::Failed {
                    job_id: request.job_id.clone(),
                    error: PublicAiError::new(AiErrorCode::StreamIdleTimeout),
                },
            );
            record_usage(&storage, &request, started_at, "failed", AiUsage::default());
            return;
        } else if cancellation.is_cancelled() {
            finish_cancelled(&request, &channel, &storage, started_at, AiUsage::default());
            return;
        }
        let outcome = stream_once(
            &request,
            &preferences,
            &key,
            &cancellation,
            &channel,
            hard_deadline,
        )
        .await;
        match outcome {
            AttemptOutcome::Completed {
                usage,
                finish_reason,
            } => {
                send(
                    &channel,
                    AiStreamEvent::Completed {
                        job_id: request.job_id.clone(),
                        finish_reason,
                    },
                );
                record_usage(&storage, &request, started_at, "completed", usage);
                return;
            }
            AttemptOutcome::Cancelled { usage } => {
                finish_cancelled(&request, &channel, &storage, started_at, usage);
                return;
            }
            AttemptOutcome::Failed {
                error,
                received_content,
                usage,
            } => {
                if !received_content
                    && retry_count < 2
                    && matches!(
                        error.code,
                        AiErrorCode::NetworkUnavailable
                            | AiErrorCode::RateLimited
                            | AiErrorCode::ProviderOverloaded
                            | AiErrorCode::ProviderServerError
                    )
                {
                    retry_count += 1;
                    let jitter = request
                        .job_id
                        .bytes()
                        .fold(0_u64, |value, byte| value.wrapping_add(u64::from(byte)))
                        % 201;
                    let backoff = Duration::from_millis(
                        if retry_count == 1 { 1_000 } else { 3_000 } + jitter,
                    );
                    tokio::select! {
                        () = cancellation.cancelled() => {
                            finish_cancelled(
                                &request,
                                &channel,
                                &storage,
                                started_at,
                                usage,
                            );
                            return;
                        }
                        () = tokio::time::sleep_until(hard_deadline) => {
                            send(
                                &channel,
                                AiStreamEvent::Failed {
                                    job_id: request.job_id.clone(),
                                    error: PublicAiError::new(AiErrorCode::StreamIdleTimeout),
                                },
                            );
                            record_usage(&storage, &request, started_at, "failed", usage);
                            return;
                        }
                        () = tokio::time::sleep(backoff) => {}
                    }
                    continue;
                }
                send(
                    &channel,
                    AiStreamEvent::Failed {
                        job_id: request.job_id.clone(),
                        error,
                    },
                );
                record_usage(&storage, &request, started_at, "failed", usage);
                return;
            }
        }
    }
}

async fn stream_once(
    request: &AiGenerateRequest,
    preferences: &AiProviderPreferences,
    key: &SecretValue,
    cancellation: &CancellationToken,
    channel: &Channel<AiStreamEvent>,
    hard_deadline: Instant,
) -> AttemptOutcome {
    let client = match DeepSeekClient::new(preferences.connection_timeout_ms) {
        Ok(client) => client,
        Err(error) => {
            return AttemptOutcome::Failed {
                error,
                received_content: false,
                usage: AiUsage::default(),
            };
        }
    };
    let connection_wait = Duration::from_millis(preferences.connection_timeout_ms)
        .min(hard_deadline.saturating_duration_since(Instant::now()));
    let response = tokio::select! {
        () = cancellation.cancelled() => {
            return AttemptOutcome::Cancelled { usage: AiUsage::default() };
        }
        response = timeout(
            connection_wait,
            client.open_stream(key, request),
        ) => {
            match response {
                Ok(Ok(response)) => response,
                Ok(Err(error)) => {
                    return AttemptOutcome::Failed {
                        error,
                        received_content: false,
                        usage: AiUsage::default(),
                    };
                }
                Err(_) => {
                    return AttemptOutcome::Failed {
                        error: PublicAiError::new(AiErrorCode::ConnectionTimeout),
                        received_content: false,
                        usage: AiUsage::default(),
                    };
                }
            }
        }
    };
    send(
        channel,
        AiStreamEvent::ConnectionOpened {
            job_id: request.job_id.clone(),
        },
    );

    let mut bytes_stream = Box::pin(response.bytes_stream());
    let mut decoder = SseDecoder::default();
    let first_content_deadline =
        Instant::now() + Duration::from_millis(preferences.first_content_timeout_ms);
    let idle_timeout = Duration::from_millis(preferences.stream_idle_timeout_ms);
    let mut received_content = false;
    let mut saw_done = false;
    let mut thinking_announced = false;
    let mut usage = AiUsage::default();
    let mut finish_reason = None;
    let mut pending_content = String::new();
    let mut pending_deadline: Option<Instant> = None;
    let mut idle_deadline = Instant::now() + idle_timeout;

    'stream: loop {
        let provider_deadline = if received_content {
            idle_deadline
        } else {
            first_content_deadline
        };
        let next_deadline = pending_deadline
            .map(|deadline| deadline.min(provider_deadline).min(hard_deadline))
            .unwrap_or_else(|| provider_deadline.min(hard_deadline));
        let wait = next_deadline.saturating_duration_since(Instant::now());
        if wait.is_zero() && pending_deadline.is_some_and(|deadline| deadline <= Instant::now()) {
            flush_content(
                request,
                channel,
                &mut pending_content,
                &mut pending_deadline,
            );
            continue;
        }
        if wait.is_zero() {
            return AttemptOutcome::Failed {
                error: PublicAiError::new(if received_content {
                    AiErrorCode::StreamIdleTimeout
                } else {
                    AiErrorCode::FirstContentTimeout
                }),
                received_content,
                usage,
            };
        }
        let chunk = tokio::select! {
            () = cancellation.cancelled() => {
                flush_content(request, channel, &mut pending_content, &mut pending_deadline);
                return AttemptOutcome::Cancelled { usage };
            }
            result = timeout(wait, bytes_stream.next()) => {
                match result {
                    Err(_) if pending_deadline.is_some_and(|deadline| deadline <= Instant::now()) => {
                        flush_content(request, channel, &mut pending_content, &mut pending_deadline);
                        continue;
                    }
                    Err(_) if received_content || Instant::now() >= hard_deadline => {
                        return AttemptOutcome::Failed {
                            error: PublicAiError::new(AiErrorCode::StreamIdleTimeout),
                            received_content,
                            usage,
                        };
                    }
                    Err(_) => {
                        return AttemptOutcome::Failed {
                            error: PublicAiError::new(AiErrorCode::FirstContentTimeout),
                            received_content,
                            usage,
                        };
                    }
                    Ok(value) => value,
                }
            }
        };
        idle_deadline = Instant::now() + idle_timeout;
        let Some(chunk) = chunk else {
            break;
        };
        let chunk = match chunk {
            Ok(bytes) => bytes,
            Err(error) => {
                return AttemptOutcome::Failed {
                    error: crate::ai::errors::network_error(&error),
                    received_content,
                    usage,
                };
            }
        };
        let frames = match decoder.push(&chunk) {
            Ok(frames) => frames,
            Err(error) => {
                return AttemptOutcome::Failed {
                    error,
                    received_content,
                    usage,
                };
            }
        };
        for frame in frames {
            match handle_frame(
                frame,
                request,
                channel,
                &mut received_content,
                &mut thinking_announced,
                &mut usage,
                &mut finish_reason,
                &mut pending_content,
                &mut pending_deadline,
            ) {
                Ok(true) => {
                    saw_done = true;
                    break 'stream;
                }
                Ok(false) => {}
                Err(error) => {
                    return AttemptOutcome::Failed {
                        error,
                        received_content,
                        usage,
                    };
                }
            }
        }
    }

    if !saw_done {
        let frames = match decoder.finish() {
            Ok(frames) => frames,
            Err(error) => {
                return AttemptOutcome::Failed {
                    error,
                    received_content,
                    usage,
                };
            }
        };
        for frame in frames {
            match handle_frame(
                frame,
                request,
                channel,
                &mut received_content,
                &mut thinking_announced,
                &mut usage,
                &mut finish_reason,
                &mut pending_content,
                &mut pending_deadline,
            ) {
                Ok(true) => saw_done = true,
                Ok(false) => {}
                Err(error) => {
                    return AttemptOutcome::Failed {
                        error,
                        received_content,
                        usage,
                    };
                }
            }
        }
    }
    if !saw_done {
        flush_content(
            request,
            channel,
            &mut pending_content,
            &mut pending_deadline,
        );
        return AttemptOutcome::Failed {
            error: PublicAiError::new(AiErrorCode::StreamIncomplete),
            received_content,
            usage,
        };
    }
    flush_content(
        request,
        channel,
        &mut pending_content,
        &mut pending_deadline,
    );
    if !received_content {
        return AttemptOutcome::Failed {
            error: PublicAiError::new(AiErrorCode::EmptyResponse),
            received_content,
            usage,
        };
    }
    AttemptOutcome::Completed {
        usage,
        finish_reason,
    }
}

fn handle_frame(
    frame: SseFrame,
    request: &AiGenerateRequest,
    channel: &Channel<AiStreamEvent>,
    received_content: &mut bool,
    thinking_announced: &mut bool,
    usage: &mut AiUsage,
    finish_reason: &mut Option<String>,
    pending_content: &mut String,
    pending_deadline: &mut Option<Instant>,
) -> Result<bool, PublicAiError> {
    let SseFrame::Data(data) = frame else {
        flush_content(request, channel, pending_content, pending_deadline);
        return Ok(true);
    };
    for parsed in parse_stream_json(&data)? {
        match parsed {
            ParsedChunk::Thinking if !*thinking_announced => {
                *thinking_announced = true;
                send(
                    channel,
                    AiStreamEvent::ThinkingStarted {
                        job_id: request.job_id.clone(),
                    },
                );
            }
            ParsedChunk::Content(text) => {
                *received_content = true;
                if pending_content.is_empty() {
                    *pending_deadline = Some(Instant::now() + DELTA_FLUSH_INTERVAL);
                }
                pending_content.push_str(&text);
                if pending_content.chars().count() >= DELTA_FLUSH_CHARS {
                    flush_content(request, channel, pending_content, pending_deadline);
                }
            }
            ParsedChunk::Usage(value) => {
                flush_content(request, channel, pending_content, pending_deadline);
                *usage = value.clone();
                send(
                    channel,
                    AiStreamEvent::Usage {
                        job_id: request.job_id.clone(),
                        usage: value,
                    },
                );
            }
            ParsedChunk::Finish(value) => {
                flush_content(request, channel, pending_content, pending_deadline);
                *finish_reason = value;
            }
            ParsedChunk::Thinking | ParsedChunk::Empty => {}
        }
    }
    Ok(false)
}

fn flush_content(
    request: &AiGenerateRequest,
    channel: &Channel<AiStreamEvent>,
    pending_content: &mut String,
    pending_deadline: &mut Option<Instant>,
) {
    if !pending_content.is_empty() {
        send(
            channel,
            AiStreamEvent::ContentDelta {
                job_id: request.job_id.clone(),
                text: std::mem::take(pending_content),
            },
        );
    }
    *pending_deadline = None;
}

fn finish_cancelled(
    request: &AiGenerateRequest,
    channel: &Channel<AiStreamEvent>,
    storage: &AiStorage,
    started_at: StdInstant,
    usage: AiUsage,
) {
    send(
        channel,
        AiStreamEvent::Cancelled {
            job_id: request.job_id.clone(),
        },
    );
    record_usage(storage, request, started_at, "cancelled", usage);
}

fn record_usage(
    storage: &AiStorage,
    request: &AiGenerateRequest,
    started_at: StdInstant,
    status: &str,
    usage: AiUsage,
) {
    let _ = storage.append_usage(&AiUsageRecord {
        timestamp: Utc::now().to_rfc3339(),
        provider_id: request.provider_id.clone(),
        model_id: request.model_id.clone(),
        job_type: request.job_type.as_str().to_owned(),
        duration_ms: started_at.elapsed().as_millis().min(u128::from(u64::MAX)) as u64,
        status: status.to_owned(),
        usage,
    });
}

fn send(channel: &Channel<AiStreamEvent>, event: AiStreamEvent) {
    let _ = channel.send(event);
}

enum AttemptOutcome {
    Completed {
        usage: AiUsage,
        finish_reason: Option<String>,
    },
    Cancelled {
        usage: AiUsage,
    },
    Failed {
        error: PublicAiError,
        received_content: bool,
        usage: AiUsage,
    },
}
