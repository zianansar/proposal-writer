use crate::{db, events, humanization, network, sanitization::sanitize_job_content, DraftState};
use futures::StreamExt;
use serde::{Deserialize, Serialize};
use std::env;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

const ANTHROPIC_API_URL: &str = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION: &str = "2023-06-01";
const MODEL: &str = "claude-sonnet-4-20250514";
const HAIKU_MODEL: &str = "claude-haiku-4-20250514";
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
    /// Story 4a.9 H3: Indicates if job content was truncated during sanitization
    pub was_truncated: bool,
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

// Story 3.2: Perplexity analysis with flagged sentences
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FlaggedSentence {
    pub text: String,
    pub suggestion: String,
    pub index: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PerplexityAnalysis {
    pub score: f32,
    pub threshold: f32,
    pub flagged_sentences: Vec<FlaggedSentence>,
}

/// TD-1: Rewritten to remove formulaic structure that triggers AI detection.
/// Research shows numbered paragraph templates are a strong detection signal.
pub const SYSTEM_PROMPT: &str = r#"You are writing an Upwork proposal on behalf of a freelancer. The proposal should:
- Open by showing you understand the client's specific problem (reference details from their job post)
- Briefly mention relevant experience and your approach
- End with availability and a clear next step

Keep it under 200 words. Write like a real freelancer — direct, confident, conversational."#;

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
    generate_proposal_with_key(job_content, None, "medium", None).await
}

pub async fn generate_proposal_with_key(
    job_content: &str,
    api_key: Option<&str>,
    humanization_intensity: &str,
    app_handle: Option<&AppHandle>,
) -> Result<String, String> {
    let api_key = resolve_api_key(api_key)?;

    // Story 4a.9: Sanitize input before constructing prompt (AC-1, AC-5)
    let sanitization_result = sanitize_job_content(job_content);

    // AC-3: Log truncation warning if content was truncated
    if sanitization_result.was_truncated {
        tracing::warn!(
            "Job post truncated: original {} chars, kept ~100K chars",
            sanitization_result.original_length
        );
    }

    // Story 3.3: Build system prompt with humanization (single API call, zero latency overhead)
    let system_prompt = humanization::build_system_prompt(SYSTEM_PROMPT, humanization_intensity);

    // AR-16: Log intensity, not prompt content
    tracing::info!(intensity = %humanization_intensity, "Generating proposal with humanization");

    let client = crate::http::client();

    // Story 4a.9 AC-2: Prompt boundary enforcement with XML delimiters (AR-13)
    // Sanitized content is already XML-escaped, safe to wrap in <job_post> tags
    let user_message = format!(
        "<job_post>\n{}\n</job_post>\n\nGenerate a proposal for this job:",
        sanitization_result.content
    );

    let request_body = ClaudeRequest {
        model: MODEL.to_string(),
        max_tokens: 1024,
        system: system_prompt,
        messages: vec![Message {
            role: "user".to_string(),
            content: user_message,
        }],
        stream: None, // Non-streaming request
    };

    // AR-14: Validate domain before making request (network allowlist enforcement)
    // Task 4.2: Emit event if domain is blocked and AppHandle is available
    if let Err(e) = network::validate_url(ANTHROPIC_API_URL) {
        if let (Some(handle), network::NetworkError::BlockedDomain(domain)) = (app_handle, &e) {
            network::emit_blocked_event(handle, domain.clone(), ANTHROPIC_API_URL.to_string());
        }
        return Err(format!("Network security: {}", e));
    }

    let response = client
        .post(ANTHROPIC_API_URL)
        .timeout(Duration::from_secs(30))
        .header("x-api-key", &api_key)
        .header("anthropic-version", ANTHROPIC_VERSION)
        .header("content-type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| {
            let error_msg = if e.is_timeout() {
                "Generation timed out. Try again.".to_string()
            } else if e.is_connect() {
                "Unable to reach AI service. Check your internet connection.".to_string()
            } else {
                format!("Network error: {}", e)
            };
            tracing::error!("Proposal generation failed: {}", error_msg);
            error_msg
        })?;

    let status = response.status();

    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_default();
        if let Ok(error) = serde_json::from_str::<ClaudeError>(&error_text) {
            tracing::error!("API error: {}", error.error.message);
            return Err(format!("API error: {}", error.error.message));
        }
        tracing::error!("API error ({}): {}", status, error_text);
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
/// Story 3.3: Humanization instructions injected via system prompt (zero latency overhead).
/// Story 4a.9: Input sanitization with prompt injection defense (AR-13, AC-1, AC-2, AC-3).
/// TD-1: Added rehumanization_attempt for boost prompts on regeneration.
pub async fn generate_proposal_streaming_with_key(
    job_content: &str,
    app_handle: AppHandle,
    api_key: Option<&str>,
    database: &db::Database,
    draft_state: &DraftState,
    humanization_intensity: &str,
    rehumanization_attempt: Option<u32>,
) -> Result<String, String> {
    let api_key = resolve_api_key(api_key)?;

    // Story 4a.9: Sanitize input before constructing prompt (AC-1, AC-5)
    let sanitization_result = sanitize_job_content(job_content);
    // H3 fix: Track truncation to propagate to frontend via completion event
    let was_truncated = sanitization_result.was_truncated;

    // AC-3: Log truncation warning if content was truncated
    if was_truncated {
        tracing::warn!(
            "Job post truncated during generation: original {} chars, kept ~100K chars",
            sanitization_result.original_length
        );
    }

    // Story 3.3 + TD-1: Build system prompt with humanization (single API call, zero latency overhead)
    // TD-1: Use rehumanization boost on retry attempts for stronger anti-detection
    let system_prompt = match rehumanization_attempt {
        Some(attempt) => humanization::build_rehumanization_prompt(
            SYSTEM_PROMPT,
            humanization_intensity,
            attempt,
        ),
        None => humanization::build_system_prompt(SYSTEM_PROMPT, humanization_intensity),
    };

    // AR-16: Log intensity, not prompt content
    tracing::info!(intensity = %humanization_intensity, attempt = ?rehumanization_attempt, "Generating streaming proposal with humanization");

    let client = crate::http::client();

    // Create async queue for draft saves (Code Review Fix: prevents race conditions)
    // Queue ensures saves execute sequentially even if token batches arrive faster than saves complete
    let (save_tx, mut save_rx) = tokio::sync::mpsc::unbounded_channel::<(String, String)>();

    // Story 4a.9 AC-2: Prompt boundary enforcement with XML delimiters (AR-13)
    // Sanitized content is already XML-escaped, safe to wrap in <job_post> tags
    let user_message = format!(
        "<job_post>\n{}\n</job_post>\n\nGenerate a proposal for this job:",
        sanitization_result.content
    );

    let request_body = ClaudeRequest {
        model: MODEL.to_string(),
        max_tokens: 1024,
        system: system_prompt,
        messages: vec![Message {
            role: "user".to_string(),
            content: user_message,
        }],
        stream: Some(true),
    };

    // AR-14: Validate domain before making request (network allowlist enforcement)
    // Task 4.2: Emit event if domain is blocked
    if let Err(e) = network::validate_url(ANTHROPIC_API_URL) {
        match &e {
            network::NetworkError::BlockedDomain(domain) => {
                network::emit_blocked_event(
                    &app_handle,
                    domain.clone(),
                    ANTHROPIC_API_URL.to_string(),
                );
            }
            network::NetworkError::InvalidUrl(_) => {
                // Invalid URL doesn't need event emission, just error
            }
        }
        return Err(format!("Network security: {}", e));
    }

    let response = client
        .post(ANTHROPIC_API_URL)
        .timeout(Duration::from_secs(60)) // Longer timeout for streaming
        .header("x-api-key", &api_key)
        .header("anthropic-version", ANTHROPIC_VERSION)
        .header("content-type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| {
            let error_msg = if e.is_timeout() {
                "Generation timed out. Try again.".to_string()
            } else if e.is_connect() {
                "Unable to reach AI service. Check your internet connection.".to_string()
            } else {
                format!("Network error: {}", e)
            };
            tracing::error!("Proposal generation failed: {}", error_msg);
            error_msg
        })?;

    let status = response.status();

    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_default();
        if let Ok(error) = serde_json::from_str::<ClaudeError>(&error_text) {
            tracing::error!("API error: {}", error.error.message);
            return Err(format!("API error: {}", error.error.message));
        }
        tracing::error!("API error ({}): {}", status, error_text);
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
                if let Err(e) = db::queries::proposals::update_proposal_text(&conn, id, &text) {
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
                eprintln!(
                    "Warning: Failed to update final draft text for {}: {}",
                    id, e
                );
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
    // H3 fix: Include was_truncated to show warning in frontend
    let _ = app_handle.emit(
        events::GENERATION_COMPLETE,
        CompletePayload {
            full_text: full_text.clone(),
            was_truncated,
        },
    );

    Ok(full_text)
}

/// Parse a perplexity score from LLM response text.
/// Handles formats: "150", "150.5", "Score: 150", "The score is 150.75"
/// Uses last number found — LLM may mention thresholds/context before the actual score.
pub fn parse_perplexity_score(text: &str) -> Result<f32, String> {
    // First try parsing the whole trimmed text as a number (most common case)
    if let Ok(score) = text.trim().parse::<f32>() {
        return Ok(score);
    }

    // Fall back to extracting the last numeric token
    text.split_whitespace()
        .filter_map(|word| {
            word.trim_matches(|c: char| !c.is_numeric() && c != '.')
                .parse::<f32>()
                .ok()
        })
        .last()
        .ok_or_else(|| format!("Could not parse perplexity score from: {}", text))
}

/// Extract JSON from LLM response text.
/// Handles common patterns: raw JSON, JSON wrapped in ```json code blocks,
/// or JSON preceded by preamble text.
pub fn extract_json_from_response(text: &str) -> &str {
    let trimmed = text.trim();

    // Try raw JSON first (starts with { or [)
    if trimmed.starts_with('{') || trimmed.starts_with('[') {
        return trimmed;
    }

    // Try extracting from ```json ... ``` code blocks
    if let Some(start) = trimmed.find("```json") {
        let json_start = start + 7; // skip "```json"
        if let Some(end) = trimmed[json_start..].find("```") {
            return trimmed[json_start..json_start + end].trim();
        }
    }

    // Try extracting from ``` ... ``` code blocks (no language tag)
    if let Some(start) = trimmed.find("```") {
        let json_start = start + 3;
        if let Some(end) = trimmed[json_start..].find("```") {
            let candidate = trimmed[json_start..json_start + end].trim();
            if candidate.starts_with('{') || candidate.starts_with('[') {
                return candidate;
            }
        }
    }

    // Try finding first { to last } (JSON object in surrounding text)
    if let Some(start) = trimmed.find('{') {
        if let Some(end) = trimmed.rfind('}') {
            if end > start {
                return &trimmed[start..=end];
            }
        }
    }

    // Give up — return as-is for serde to report the error
    trimmed
}

/// Analyze text for AI detection risk using Claude Haiku.
/// Returns a perplexity score (0-300+). Higher = more human-like.
/// Threshold: <180 = safe, ≥180 = risky (per FR-11, Story 3.1)
#[deprecated(note = "Use analyze_perplexity_with_sentences for structured analysis (Story 3.2)")]
pub async fn analyze_perplexity(
    text: &str,
    api_key: Option<&str>,
    app_handle: Option<&AppHandle>,
) -> Result<f32, String> {
    let api_key = resolve_api_key(api_key)?;

    let client = crate::http::client();

    // Prompt for perplexity analysis
    let system_prompt = "You are an AI detection analyzer. Analyze the given text and return ONLY a numeric perplexity score (0-300). Higher scores indicate more human-like writing. Return only the number, no other text.";

    let user_message = format!(
        "Analyze this proposal text for AI detection risk:\n\n{}\n\nReturn only the perplexity score as a number.",
        text
    );

    let request_body = ClaudeRequest {
        model: HAIKU_MODEL.to_string(),
        max_tokens: 50, // Just need a number
        system: system_prompt.to_string(),
        messages: vec![Message {
            role: "user".to_string(),
            content: user_message,
        }],
        stream: None, // No streaming for quick analysis
    };

    // AR-14: Validate domain before making request (network allowlist enforcement)
    // Task 4.2: Emit event if domain is blocked and AppHandle is available
    if let Err(e) = network::validate_url(ANTHROPIC_API_URL) {
        if let (Some(handle), network::NetworkError::BlockedDomain(domain)) = (app_handle, &e) {
            network::emit_blocked_event(handle, domain.clone(), ANTHROPIC_API_URL.to_string());
        }
        return Err(format!("Network security: {}", e));
    }

    let response = client
        .post(ANTHROPIC_API_URL)
        .timeout(Duration::from_secs(10)) // Fast analysis
        .header("x-api-key", &api_key)
        .header("anthropic-version", ANTHROPIC_VERSION)
        .header("content-type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| {
            let error_msg = if e.is_timeout() {
                "Perplexity analysis timed out".to_string()
            } else if e.is_connect() {
                "Unable to reach AI service for analysis".to_string()
            } else {
                format!("Network error during analysis: {}", e)
            };
            tracing::error!("Perplexity analysis failed: {}", error_msg);
            error_msg
        })?;

    let status = response.status();

    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_default();
        if let Ok(error) = serde_json::from_str::<ClaudeError>(&error_text) {
            tracing::error!("Perplexity analysis API error: {}", error.error.message);
            return Err(format!("API error: {}", error.error.message));
        }
        tracing::error!("Perplexity analysis API error ({}): {}", status, error_text);
        return Err(format!("API error ({})", status));
    }

    // Parse response
    let response_json: ClaudeResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse API response: {}", e))?;

    // Extract score from response
    let score_text = response_json
        .content
        .first()
        .and_then(|block| block.text.as_ref())
        .ok_or_else(|| "No content in API response".to_string())?;

    let score = parse_perplexity_score(score_text)?;

    tracing::info!("Perplexity analysis complete: score={}", score);
    Ok(score)
}

/// Enhanced perplexity analysis with flagged sentences (Story 3.2 + 3.5)
/// Returns perplexity score AND specific risky sentences with humanization suggestions
/// Uses Claude Haiku for cost-effective detailed analysis
/// Story 3.5: Accepts configurable threshold parameter (140-220, default 180)
/// Task 4.2: Added AppHandle for network event emission
pub async fn analyze_perplexity_with_sentences(
    text: &str,
    threshold: i32,
    api_key: Option<&str>,
    app_handle: Option<&AppHandle>,
) -> Result<PerplexityAnalysis, String> {
    let api_key = resolve_api_key(api_key)?;

    let client = crate::http::client();

    // Enhanced prompt for sentence-level analysis
    let system_prompt =
        "You are an AI detection analyzer. Analyze the given text and return a JSON response with:
1. Perplexity score (0-300, higher = more human-like)
2. The 3-5 most AI-sounding sentences with specific humanization suggestions

Be specific with suggestions - avoid generic advice like 'add variety'. Provide actionable fixes.";

    let user_message = format!(
        r#"Analyze this proposal for AI detection risk:

{}

Return JSON in this exact format:
{{
  "score": 185.5,
  "flagged_sentences": [
    {{
      "text": "exact sentence from proposal",
      "suggestion": "specific actionable fix (e.g., 'Replace X with Y for more natural phrasing')",
      "index": 0
    }}
  ]
}}

Return ONLY valid JSON, no other text."#,
        text
    );

    let request_body = ClaudeRequest {
        model: HAIKU_MODEL.to_string(),
        max_tokens: 1000, // Need more tokens for sentence analysis
        system: system_prompt.to_string(),
        messages: vec![Message {
            role: "user".to_string(),
            content: user_message,
        }],
        stream: None,
    };

    // AR-14: Validate domain before making request (network allowlist enforcement)
    // Task 4.2: Emit event if domain is blocked and AppHandle is available
    if let Err(e) = network::validate_url(ANTHROPIC_API_URL) {
        if let (Some(handle), network::NetworkError::BlockedDomain(domain)) = (app_handle, &e) {
            network::emit_blocked_event(handle, domain.clone(), ANTHROPIC_API_URL.to_string());
        }
        return Err(format!("Network security: {}", e));
    }

    let response = client
        .post(ANTHROPIC_API_URL)
        .timeout(Duration::from_secs(15)) // Slightly longer for sentence analysis
        .header("x-api-key", &api_key)
        .header("anthropic-version", ANTHROPIC_VERSION)
        .header("content-type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| {
            let error_msg = if e.is_timeout() {
                "Sentence analysis timed out".to_string()
            } else if e.is_connect() {
                "Unable to reach AI service for analysis".to_string()
            } else {
                format!("Network error during analysis: {}", e)
            };
            tracing::error!("Sentence analysis failed: {}", error_msg);
            error_msg
        })?;

    let status = response.status();

    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_default();
        if let Ok(error) = serde_json::from_str::<ClaudeError>(&error_text) {
            tracing::error!("Sentence analysis API error: {}", error.error.message);
            return Err(format!("API error: {}", error.error.message));
        }
        tracing::error!("Sentence analysis API error ({}): {}", status, error_text);
        return Err(format!("API error ({})", status));
    }

    // Parse response
    let response_json: ClaudeResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse API response: {}", e))?;

    // Extract JSON from response
    let response_text = response_json
        .content
        .first()
        .and_then(|block| block.text.as_ref())
        .ok_or_else(|| "No content in API response".to_string())?;

    // Parse structured response (with fallback for LLM wrapping JSON in code blocks)
    #[derive(Deserialize)]
    struct HaikuAnalysisResponse {
        score: f32,
        flagged_sentences: Vec<FlaggedSentence>,
    }

    let json_str = extract_json_from_response(response_text);
    let analysis: HaikuAnalysisResponse = serde_json::from_str(json_str).map_err(|e| {
        tracing::warn!(
            "Failed to parse sentence analysis JSON: {}. Response: {}",
            e,
            response_text
        );
        format!("Failed to parse analysis response: {}", e)
    })?;

    let result = PerplexityAnalysis {
        score: analysis.score,
        threshold: threshold as f32, // Story 3.5: Use configurable threshold
        flagged_sentences: analysis.flagged_sentences,
    };

    tracing::info!(
        "Perplexity analysis complete: score={}, flagged_count={}",
        result.score,
        result.flagged_sentences.len()
    );

    Ok(result)
}
