use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::env;
use std::time::Duration;

const ANTHROPIC_API_URL: &str = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION: &str = "2023-06-01";
const MODEL: &str = "claude-sonnet-4-20250514";

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

pub async fn generate_proposal(job_content: &str) -> Result<String, String> {
    let api_key = env::var("ANTHROPIC_API_KEY")
        .map_err(|_| "ANTHROPIC_API_KEY environment variable not set. Please set it to your Anthropic API key.".to_string())?;

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
