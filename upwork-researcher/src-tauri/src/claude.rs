use crate::{db, events, DraftState};
use futures::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::env;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

const ANTHROPIC_API_URL: &str = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION: &str = "2023-06-01";
const MODEL: &str = "claude-sonnet-4-20250514";
const TOKEN_BATCH_INTERVAL_MS: u64 = 50;

#[derive(Debug, Serialize)]
struct Message {
    role: String,
    content: String,
}

#[derive(Debug, Serialize)]
struct ClaudeRequest {
    model: String,
    max_tokens: u32,
    system: String,
    messages: Vec<Message>,
    #[serde(skip_serializing_if = "Option::is_none")]
    stream: Option<bool>,
}

// SSE event types for streaming responses
#[derive(Debug, Deserialize)]
struct ContentBlockDelta {
    delta: Delta,
}

#[derive(Debug, Deserialize)]
struct Delta {
    #[serde(rename = "type")]
    delta_type: String,
    #[serde(default)]
    text: String,
}

// Tauri event payloads
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenPayload {
    pub tokens: Vec<String>,
    pub stage_id: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompletePayload {
    pub full_text: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ErrorPayload {
    pub message: String,
}

#[derive(Debug, Deserialize)]
struct ContentBlock {
    text: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ClaudeResponse {
    content: Vec<ContentBlock>,
}

#[derive(Debug, Deserialize)]
struct ClaudeError {
    error: ClaudeErrorDetail,
}

#[derive(Debug, Deserialize)]
struct ClaudeErrorDetail {
    message: String,
}

const SYSTEM_PROMPT: &str = r#"You are an expert Upwork proposal writer. Generate a 3-paragraph proposal:
1. Hook: Open with a specific insight about the client's problem that shows you read the job post
2. Bridge: Explain your relevant experience and approach to solving their problem
3. CTA: End with a clear call to action and availability

Keep the total length under 200 words. Write in a professional but conversational tone."#;

/// Get API key from environment variable or provided value.
fn resolve_api_key(provided_key: Option<&str>) -> Result<String, String> {
    // First try provided key (from config)
    if let Some(key) = provided_key {
        if !key.is_empty() {
            return Ok(key.to_string());
        }
    }

    // Fall back to environment variable
    env::var("ANTHROPIC_API_KEY").map_err(|_| {
        "No API key configured. Please add your Anthropic API key in Settings.".to_string()
    })
}

pub async fn generate_proposal(job_content: &str) -> Result<String, String> {
    generate_proposal_with_key(job_content, None).await
}

pub async fn generate_proposal_with_key(
    job_content: &str,
    api_key: Option<&str>,
) -> Result<String, String> {
    let api_key = resolve_api_key(api_key)?;

    let client = Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    // Prompt boundary enforcement: job content in user role with explicit delimiters
    let user_message = format!(
        "[JOB_CONTENT_DELIMITER_START]\n{}\n[JOB_CONTENT_DELIMITER_END]\n\nGenerate a proposal for this job:",
        job_content
    );

    let request_body = ClaudeRequest {
        model: MODEL.to_string(),
        max_tokens: 1024,
        system: SYSTEM_PROMPT.to_string(),
        messages: vec![Message {
            role: "user".to_string(),
            content: user_message,
        }],
        stream: None, // Non-streaming request
    };

    let response = client
        .post(ANTHROPIC_API_URL)
        .header("x-api-key", &api_key)
        .header("anthropic-version", ANTHROPIC_VERSION)
        .header("content-type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                "Generation timed out. Try again.".to_string()
            } else if e.is_connect() {
                "Unable to reach AI service. Check your internet connection.".to_string()
            } else {
                format!("Network error: {}", e)
            }
        })?;

    let status = response.status();

    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_default();
        if let Ok(error) = serde_json::from_str::<ClaudeError>(&error_text) {
            return Err(format!("API error: {}", error.error.message));
        }
        return Err(format!("API error ({}): {}", status, error_text));
    }

    let claude_response: ClaudeResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse API response: {}", e))?;

    claude_response
        .content
        .first()
        .and_then(|block| block.text.clone())
        .ok_or_else(|| "No text in API response".to_string())
}

/// Generate a proposal with streaming, emitting batched tokens via Tauri events.
/// Tokens are batched for 50ms before emission to reduce frontend re-renders.
/// DEPRECATED: This function does not support draft auto-save (Story 1.14).
/// Use generate_proposal_streaming_with_key with database and draft_state parameters instead.
#[deprecated(note = "Use generate_proposal_streaming_with_key with database and draft_state")]
pub async fn generate_proposal_streaming(
    _job_content: &str,
    _app_handle: AppHandle,
) -> Result<String, String> {
    Err("generate_proposal_streaming is deprecated. Use the Tauri command instead.".to_string())
}

/// Generate a proposal with streaming using provided API key.
/// Auto-saves draft every 50ms during generation (Story 1.14).
/// Uses async queue to prevent race conditions in draft saving (Code Review Fix).
pub async fn generate_proposal_streaming_with_key(
    job_content: &str,
    app_handle: AppHandle,
    api_key: Option<&str>,
    database: &db::Database,
    draft_state: &DraftState,
) -> Result<String, String> {
    let api_key = resolve_api_key(api_key)?;

    let client = Client::builder()
        .timeout(Duration::from_secs(60)) // Longer timeout for streaming
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    // Create async queue for draft saves (Code Review Fix: prevents race conditions)
    // Queue ensures saves execute sequentially even if token batches arrive faster than saves complete
    let (save_tx, mut save_rx) = tokio::sync::mpsc::unbounded_channel::<(String, String)>();

    // Prompt boundary enforcement: job content in user role with explicit delimiters
    let user_message = format!(
        "[JOB_CONTENT_DELIMITER_START]\n{}\n[JOB_CONTENT_DELIMITER_END]\n\nGenerate a proposal for this job:",
        job_content
    );

    let request_body = ClaudeRequest {
        model: MODEL.to_string(),
        max_tokens: 1024,
        system: SYSTEM_PROMPT.to_string(),
        messages: vec![Message {
            role: "user".to_string(),
            content: user_message,
        }],
        stream: Some(true),
    };

    let response = client
        .post(ANTHROPIC_API_URL)
        .header("x-api-key", &api_key)
        .header("anthropic-version", ANTHROPIC_VERSION)
        .header("content-type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                "Generation timed out. Try again.".to_string()
            } else if e.is_connect() {
                "Unable to reach AI service. Check your internet connection.".to_string()
            } else {
                format!("Network error: {}", e)
            }
        })?;

    let status = response.status();

    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_default();
        if let Ok(error) = serde_json::from_str::<ClaudeError>(&error_text) {
            return Err(format!("API error: {}", error.error.message));
        }
        return Err(format!("API error ({}): {}", status, error_text));
    }

    // Process SSE stream with token batching
    let mut full_text = String::new();
    let mut token_buffer: Vec<String> = Vec::new();
    let mut last_emit = Instant::now();

    let mut stream = response.bytes_stream();

    // Buffer for incomplete SSE lines
    let mut line_buffer = String::new();

    while let Some(chunk_result) = stream.next().await {
        let chunk = match chunk_result {
            Ok(bytes) => bytes,
            Err(e) => {
                // Mid-stream error: emit what we have and notify error
                if !token_buffer.is_empty() {
                    let _ = app_handle.emit(
                        events::GENERATION_TOKEN,
                        TokenPayload {
                            tokens: token_buffer.clone(),
                            stage_id: "generation".to_string(),
                        },
                    );
                }
                let _ = app_handle.emit(
                    events::GENERATION_ERROR,
                    ErrorPayload {
                        message: format!("Generation interrupted: {}", e),
                    },
                );
                return Err(format!(
                    "Generation interrupted — partial result kept: {}",
                    e
                ));
            }
        };

        // Parse SSE data from chunk
        line_buffer.push_str(&String::from_utf8_lossy(&chunk));

        // Process complete lines
        while let Some(line_end) = line_buffer.find('\n') {
            let line = line_buffer[..line_end].trim().to_string();
            line_buffer = line_buffer[line_end + 1..].to_string();

            // SSE format: "data: {...}" or "event: ..."
            if line.starts_with("data: ") {
                let json_str = &line[6..];

                // Skip [DONE] marker
                if json_str.trim() == "[DONE]" {
                    continue;
                }

                // Try to parse as content_block_delta
                if let Ok(delta) = serde_json::from_str::<ContentBlockDelta>(json_str) {
                    if delta.delta.delta_type == "text_delta" && !delta.delta.text.is_empty() {
                        full_text.push_str(&delta.delta.text);
                        token_buffer.push(delta.delta.text);

                        // Check if 50ms has passed - emit batch AND queue draft save
                        if last_emit.elapsed() >= Duration::from_millis(TOKEN_BATCH_INTERVAL_MS) {
                            // Emit tokens to frontend (non-blocking)
                            let _ = app_handle.emit(
                                events::GENERATION_TOKEN,
                                TokenPayload {
                                    tokens: token_buffer.clone(),
                                    stage_id: "generation".to_string(),
                                },
                            );

                            // Queue draft save (non-blocking, processed sequentially after stream ends)
                            // Clone full_text snapshot to avoid race conditions
                            let text_snapshot = full_text.clone();
                            let job_snapshot = job_content.to_string();
                            if let Err(e) = save_tx.send((text_snapshot, job_snapshot)) {
                                eprintln!("Warning: Failed to queue draft save: {}", e);
                            }

                            token_buffer.clear();
                            last_emit = Instant::now();
                        }
                    }
                }
                // Silently ignore other event types (message_start, etc.)
            }
        }
    }

    // Emit any remaining tokens
    if !token_buffer.is_empty() {
        let _ = app_handle.emit(
            events::GENERATION_TOKEN,
            TokenPayload {
                tokens: token_buffer,
                stage_id: "generation".to_string(),
            },
        );
    }

    // Close the save queue channel
    drop(save_tx);

    // Drain all queued saves before marking as complete (prevents race condition)
    // This ensures every batch's save completes before we mark draft as done
    while let Ok((text, job_content)) = save_rx.try_recv() {
        if let Ok(conn) = database.conn.lock() {
            let mut draft_id = draft_state.current_draft_id.lock().unwrap();

            if let Some(id) = *draft_id {
                // Update existing draft
                if let Err(e) = db::queries::proposals::update_proposal_text(
                    &conn,
                    id,
                    &text,
                ) {
                    eprintln!("Warning: Failed to update final queued draft {}: {}", id, e);
                }
            } else {
                // Create new draft (shouldn't happen at this point, but handle it)
                match db::queries::proposals::insert_proposal(
                    &conn,
                    &job_content,
                    &text,
                    Some("draft"),
                ) {
                    Ok(id) => {
                        *draft_id = Some(id);
                    }
                    Err(e) => {
                        eprintln!("Warning: Failed to create queued draft: {}", e);
                    }
                }
            }
        } else {
            eprintln!("Warning: Failed to acquire database lock for queued draft save");
        }
    }

    // Mark draft as completed (Story 1.14)
    if let Ok(conn) = database.conn.lock() {
        let mut draft_id = draft_state.current_draft_id.lock().unwrap();

        if let Some(id) = *draft_id {
            // Update final text and mark as completed
            if let Err(e) = db::queries::proposals::update_proposal_text(&conn, id, &full_text) {
                eprintln!("Warning: Failed to update final draft text for {}: {}", id, e);
            }
            if let Err(e) = db::queries::proposals::update_proposal_status(&conn, id, "completed") {
                eprintln!("Warning: Failed to mark draft {} as completed: {}", id, e);
            }

            // Clear draft state
            *draft_id = None;
        }
    } else {
        eprintln!("Warning: Failed to acquire database lock for draft completion");
    }

    // Emit completion event
    let _ = app_handle.emit(
        events::GENERATION_COMPLETE,
        CompletePayload {
            full_text: full_text.clone(),
        },
    );

    Ok(full_text)
}
