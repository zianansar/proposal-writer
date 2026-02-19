/// Job analysis module for extracting structured insights from job posts
/// Story 4a.2: Client Name Extraction
/// Extensible design for future analysis fields (4a-3: skills, 4a-4: hidden needs)
/// Story 4a.9: Prompt injection defense via input sanitization
use crate::sanitization::sanitize_job_content;
use serde::{Deserialize, Serialize};
use std::time::Duration;

const ANTHROPIC_API_URL: &str = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION: &str = "2023-06-01";
const HAIKU_MODEL: &str = "claude-3-5-haiku-20241022";
const PROMPT_CACHING_BETA: &str = "prompt-caching-2024-07-31";

/// Hidden need detected from job post language patterns
/// Story 4a.4: Structured insight with supporting evidence
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HiddenNeed {
    pub need: String,     // "Client is stressed"
    pub evidence: String, // "They mention 'urgent' and 'ASAP'"
}

/// Extensible job analysis result
/// Story 4a.2: client_name
/// Story 4a.3: key_skills
/// Story 4a.4: hidden_needs
/// Story 4a.9: was_truncated flag for input sanitization
/// Story 4b.3: client_quality_score (0-100 integer)
/// Story 4b.4: budget_min, budget_max, budget_type (budget alignment)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobAnalysis {
    pub client_name: Option<String>,
    #[serde(default)]
    pub key_skills: Vec<String>,
    #[serde(default)]
    pub hidden_needs: Vec<HiddenNeed>,
    #[serde(default)]
    pub was_truncated: bool,
    /// Story 4b.3: Estimated client quality score (0-100, AC-1)
    pub client_quality_score: Option<i32>,
    /// Story 4b.4: Budget minimum (hourly rate or total project budget, AC-1)
    #[serde(default)]
    pub budget_min: Option<f64>,
    /// Story 4b.4: Budget maximum (only for ranges, else same as min, AC-1)
    #[serde(default)]
    pub budget_max: Option<f64>,
    /// Story 4b.4: Budget type: "hourly", "fixed", or "unknown" (AC-3)
    #[serde(default = "default_budget_type")]
    pub budget_type: String,
    /// Story 4b.4: Budget alignment percentage (0-100+ or null) (AC-2)
    #[serde(default)]
    pub budget_alignment_pct: Option<i32>,
    /// Story 4b.4: Budget alignment status: "green", "yellow", "red", "gray", "mismatch" (AC-2)
    #[serde(default = "default_alignment_status")]
    pub budget_alignment_status: String,
}

/// Default budget type when field is missing
fn default_budget_type() -> String {
    "unknown".to_string()
}

/// Default alignment status when field is missing
fn default_alignment_status() -> String {
    "gray".to_string()
}

#[derive(Debug, Serialize)]
struct Message {
    role: String,
    content: Vec<ContentBlock>,
}

#[derive(Debug, Serialize)]
#[serde(tag = "type")]
enum ContentBlock {
    #[serde(rename = "text")]
    Text {
        text: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        cache_control: Option<CacheControl>,
    },
}

#[derive(Debug, Serialize)]
struct CacheControl {
    #[serde(rename = "type")]
    control_type: String,
}

#[derive(Debug, Serialize)]
struct ClaudeRequest {
    model: String,
    max_tokens: u32,
    system: Vec<ContentBlock>,
    messages: Vec<Message>,
}

#[derive(Debug, Deserialize)]
struct ClaudeResponse {
    content: Vec<ResponseContentBlock>,
}

#[derive(Debug, Deserialize)]
struct ResponseContentBlock {
    text: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ClaudeError {
    error: ClaudeErrorDetail,
}

#[derive(Debug, Deserialize)]
struct ClaudeErrorDetail {
    message: String,
}

/// Internal response format from Claude
/// Story 4a.3: Extended to include key_skills
/// Story 4a.4: Extended to include hidden_needs
/// Story 4b.3: Extended to include client_quality_score
/// Story 4b.4: Extended to include budget fields
#[derive(Debug, Deserialize)]
struct AnalysisResponse {
    client_name: Option<String>,
    #[serde(default)]
    key_skills: Vec<String>,
    #[serde(default)]
    hidden_needs: Vec<HiddenNeed>,
    /// Story 4b.3: Client quality score (0-100)
    client_quality_score: Option<i32>,
    // Note: Budget fields removed in code review - budget extraction is handled
    // separately by extract_budget() which uses a dedicated API call (Story 4b.4)
}

// default_budget_type removed - budget extraction handled by extract_budget()

/// Budget information extracted from job post (Story 4b.4)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BudgetInfo {
    pub min: Option<f64>,
    pub max: Option<f64>,
    pub budget_type: String, // "hourly", "fixed", "unknown"
}

/// Budget alignment result (Story 4b.4, Task 5)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BudgetAlignment {
    pub percentage: Option<i32>, // 0-100+ or null
    pub status: String,          // "green", "yellow", "red", "gray", "mismatch"
}

/// Extract budget information from job post using Claude Haiku (Story 4b.4, Task 4)
/// AC-3: Parses various budget formats ($50/hr, $2000 fixed, $30-50/hour, etc.)
/// AR-5: Uses prompt caching for system prompt
pub async fn extract_budget(raw_content: &str, api_key: &str) -> Result<BudgetInfo, String> {
    let client = crate::http::client();

    // System prompt with few-shot examples (AR-5: prompt caching enabled)
    let system_prompt = r#"You are a budget extraction specialist for Upwork job posts.

Your task: Extract budget information from job post text and return structured JSON.

Output format:
{
  "budget_min": 50.0,        // Minimum budget (hourly rate or total project budget)
  "budget_max": 75.0,        // Maximum budget (only for ranges, else same as min)
  "budget_type": "hourly"    // "hourly", "fixed", or "unknown"
}

Rules:
1. Identify budget type:
   - "hourly" if text contains: "/hr", "/hour", "per hour", "hourly rate"
   - "fixed" if text contains: "fixed", "total budget", "project budget", or dollar amount without hourly indicators
   - "unknown" if no budget mentioned

2. Extract numeric values:
   - Parse "$50/hr" → 50.0
   - Parse "$5k" → 5000.0
   - Parse "$2,000" → 2000.0
   - Parse ranges "$30-50/hr" → min=30.0, max=50.0
   - Parse ranges "$5k-$10k" → min=5000.0, max=10000.0

3. If single value (not a range), set budget_max = budget_min

4. If no budget mentioned, return:
   {
     "budget_min": null,
     "budget_max": null,
     "budget_type": "unknown"
   }

5. Be conservative: If ambiguous between hourly and fixed, prefer "unknown"

Examples:

Example 1 - Hourly rate:
Job post: "Budget: $50/hour for React developer"
Response: {"budget_min": 50.0, "budget_max": 50.0, "budget_type": "hourly"}

Example 2 - Fixed price:
Job post: "Fixed price project: $2000 for landing page"
Response: {"budget_min": 2000.0, "budget_max": 2000.0, "budget_type": "fixed"}

Example 3 - Hourly range:
Job post: "Rate: $30-50/hr depending on experience"
Response: {"budget_min": 30.0, "budget_max": 50.0, "budget_type": "hourly"}

Example 4 - Fixed range with k notation:
Job post: "Budget: $5k-$10k for the project"
Response: {"budget_min": 5000.0, "budget_max": 10000.0, "budget_type": "fixed"}

Example 5 - No budget mentioned:
Job post: "Looking for experienced developer, please quote your rate"
Response: {"budget_min": null, "budget_max": null, "budget_type": "unknown"}

Return ONLY valid JSON, no other text."#;

    let user_message = format!(
        "Extract budget information from this job post:\n\n{}",
        raw_content
    );

    // AR-5: Enable prompt caching on system prompt
    let request_body = ClaudeRequest {
        model: HAIKU_MODEL.to_string(),
        max_tokens: 200, // Budget extraction is simple, small response
        system: vec![ContentBlock::Text {
            text: system_prompt.to_string(),
            cache_control: Some(CacheControl {
                control_type: "ephemeral".to_string(),
            }),
        }],
        messages: vec![Message {
            role: "user".to_string(),
            content: vec![ContentBlock::Text {
                text: user_message,
                cache_control: None,
            }],
        }],
    };

    let response = client
        .post(ANTHROPIC_API_URL)
        .timeout(Duration::from_secs(5))
        .header("x-api-key", api_key)
        .header("anthropic-version", ANTHROPIC_VERSION)
        .header("anthropic-beta", PROMPT_CACHING_BETA) // AR-5: Enable caching
        .header("content-type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| {
            let error_msg = if e.is_timeout() {
                "Budget extraction timed out".to_string()
            } else if e.is_connect() {
                "Unable to reach AI service for budget extraction".to_string()
            } else {
                format!("Network error during budget extraction: {}", e)
            };
            tracing::error!("Budget extraction failed: {}", error_msg);
            error_msg
        })?;

    let status = response.status();

    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_default();
        if let Ok(error) = serde_json::from_str::<ClaudeError>(&error_text) {
            tracing::error!("Budget extraction API error: {}", error.error.message);
            return Err(format!("API error: {}", error.error.message));
        }
        tracing::error!("Budget extraction API error ({}): {}", status, error_text);
        return Err(format!("API error ({})", status));
    }

    // Parse response
    let response_json: ClaudeResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse API response: {}", e))?;

    // Extract text from response
    let response_text = response_json
        .content
        .first()
        .and_then(|block| block.text.as_ref())
        .ok_or_else(|| "No content in API response".to_string())?;

    // Parse JSON response (handle potential code block wrapping)
    let json_str = extract_json_from_response(response_text);
    let budget_info: BudgetInfo = match serde_json::from_str(json_str) {
        Ok(info) => info,
        Err(e) => {
            tracing::warn!(
                "Failed to parse budget extraction JSON: {}. Response: {}. Defaulting to unknown.",
                e,
                response_text
            );
            // Default to unknown on parse failure (graceful degradation, Subtask 4.7)
            BudgetInfo {
                min: None,
                max: None,
                budget_type: "unknown".to_string(),
            }
        }
    };

    tracing::info!(
        "Budget extraction complete: type={}, min={:?}, max={:?}",
        budget_info.budget_type,
        budget_info.min,
        budget_info.max
    );

    Ok(budget_info)
}

/// Calculate budget alignment between job budget and user rate configuration (Story 4b.4, Task 5)
/// AC-1, AC-2, AC-4: Calculates alignment percentage and determines color status
/// Returns None for percentage if type mismatch, unknown budget, or invalid rates
pub fn calculate_budget_alignment(
    budget: &BudgetInfo,
    user_rate: &crate::RateConfig,
) -> BudgetAlignment {
    // AC-4: Type mismatch detection (Subtask 5.3)
    if budget.budget_type == "hourly" && user_rate.hourly_rate.is_none() {
        return BudgetAlignment {
            percentage: None,
            status: "mismatch".to_string(),
        };
    }
    if budget.budget_type == "fixed" && user_rate.project_rate_min.is_none() {
        return BudgetAlignment {
            percentage: None,
            status: "mismatch".to_string(),
        };
    }
    if budget.budget_type == "unknown" {
        return BudgetAlignment {
            percentage: None,
            status: "gray".to_string(),
        };
    }

    // AC-1: Calculate alignment percentage (Subtask 5.4)
    // Use budget_min for conservative estimate
    let percentage = match budget.budget_type.as_str() {
        "hourly" => {
            let job_rate = budget.min.unwrap_or(0.0);
            let user_rate_val = user_rate.hourly_rate.unwrap_or(0.0);

            // Subtask 5.6: Handle edge cases
            if user_rate_val == 0.0 || job_rate < 0.0 {
                return BudgetAlignment {
                    percentage: None,
                    status: "gray".to_string(),
                };
            }

            ((job_rate / user_rate_val) * 100.0) as i32
        }
        "fixed" => {
            let job_budget = budget.min.unwrap_or(0.0);
            let user_min = user_rate.project_rate_min.unwrap_or(0.0);

            // Subtask 5.6: Handle edge cases
            if user_min == 0.0 || job_budget < 0.0 {
                return BudgetAlignment {
                    percentage: None,
                    status: "gray".to_string(),
                };
            }

            ((job_budget / user_min) * 100.0) as i32
        }
        _ => {
            return BudgetAlignment {
                percentage: None,
                status: "gray".to_string(),
            }
        }
    };

    // AC-2: Color status based on percentage (Subtask 5.5)
    let status = if percentage >= 100 {
        "green"
    } else if percentage >= 70 {
        "yellow"
    } else {
        "red"
    }
    .to_string();

    BudgetAlignment {
        percentage: Some(percentage),
        status,
    }
}

/// Analyze job post to extract client name and key skills using Claude Haiku
/// Story 4a.2: client_name extraction
/// Story 4a.3: key_skills extraction (3-7 skills)
/// Story 4a.9: Input sanitization with prompt injection defense
/// AC-4: Completes in <3 seconds (Haiku is fast)
/// AR-5: Implements prompt caching for system prompt
/// AR-13: XML delimiter boundaries for job content
pub async fn analyze_job(raw_content: &str, api_key: &str) -> Result<JobAnalysis, String> {
    // Story 4a.9: Sanitize input before constructing prompt (AC-1, AC-5)
    let sanitization_result = sanitize_job_content(raw_content);
    let was_truncated = sanitization_result.was_truncated;

    // Log truncation if it occurred (AC-3)
    if was_truncated {
        tracing::warn!(
            "Job post truncated: original {} chars, kept ~100K chars",
            sanitization_result.original_length
        );
    }

    let client = crate::http::client();

    // System prompt with few-shot examples (AR-5: prompt caching enabled)
    // Story 4a.3: Extended to also extract key skills (3-7 skills)
    // Story 4a.4: Extended to extract hidden needs (2-3 implied priorities)
    let system_prompt = r#"You are a job post analyzer. Extract the client's name, key skills, hidden needs, and estimate client quality from Upwork job posts.

Return JSON in this exact format:
{
  "client_name": "John Smith",
  "key_skills": ["React", "TypeScript", "API Integration", "Testing"],
  "hidden_needs": [
    {"need": "Client is stressed", "evidence": "They mention 'urgent' and 'ASAP'"},
    {"need": "Budget-conscious", "evidence": "They emphasize 'cost-effective solution'"}
  ],
  "client_quality_score": 85
}

If no name is found, set client_name to null. If no skills found, return empty array. If no hidden needs identifiable, return empty array.

Guidelines - Client Name:
- Look for: greeting signatures ("Hi, I'm..."), company names, profile references, sign-offs
- If ambiguous between multiple names, prefer the hiring person over company name
- If no name is identifiable, return null

Guidelines - Key Skills:
- Extract 3-7 key technical and professional skills from the job post
- Include both explicit skills ("Must know React") and implied skills ("build REST endpoints" → "API Development")
- Normalize skill names to common industry terms (e.g., "JS" → "JavaScript", "k8s" → "Kubernetes")
- If fewer than 3 or more than 7 skills are identifiable, return whatever you find (no hard min/max)
- If no skills identifiable, return empty array []

Guidelines - Hidden Needs:
- Identify 2-3 implied client priorities NOT explicitly stated but inferable from language patterns
- Each hidden need MUST include: (a) concise label describing the priority, (b) specific evidence from the job post
- Common patterns to detect:
  * "urgent", "ASAP", "fast turnaround" → Time-pressured
  * "proven track record", "references required" → Risk-averse
  * "cost-effective", "budget-friendly" → Budget-conscious
  * "ongoing project", "monthly retainer" → Long-term partnership
  * "experienced only", "senior developer" → Burned by junior devs
  * "NDA required", "confidential" → IP/trust concerns
  * "detailed proposal expected" → Values thoroughness
- If the job post is too vague or generic to infer hidden needs, return empty array []
- Do NOT fabricate needs — only infer from actual language in the post
- Avoid duplicating similar concepts (e.g., "urgent" and "time-pressured" should be one need)
- Keep evidence concise (1 sentence max, quote key phrases)

Guidelines - Client Quality Score (0-100 integer):
Estimate the client's quality based on signals in the job post. Return an integer from 0-100.

High Quality (80-100):
- Mentions: "verified payment method", "payment verified", "100% hire rate", "$XX,XXX+ spent on Upwork"
- Well-written, specific requirements, professional tone
- Detailed project description with clear scope
- Realistic timeline and budget expectations
- Mentions previous successful hires or reviews

Medium Quality (60-79):
- Some specificity but lacks detail
- Professional but generic language
- Reasonable expectations
- No major red flags

Low Quality (0-59):
- "0 hires", "no hire history", "new to Upwork"
- Vague requirements: "I need a website", "looking for expert"
- Red flags: "URGENT!!!", "ASAP needed", "very low budget", "work for exposure"
- Poor grammar, copy-pasted template, demanding tone
- Unrealistic expectations: "need full app in 2 days for $50"

Hard Rules:
- If "0 hires" explicitly mentioned → score 45 (override inference)
- If no clear signals → default 65 (neutral assumption)

Examples:

Example 1 - Technical job with explicit client (high quality):
Job post: "Hi! I'm Sarah Chen, founder of TechStartup Inc. Looking for a React developer to build our dashboard. Must have experience with TypeScript, REST APIs, and unit testing. We've completed 15 projects on Upwork with a 100% hire rate and verified payment."
Response: {"client_name": "Sarah Chen", "key_skills": ["React", "TypeScript", "REST APIs", "Unit Testing"], "hidden_needs": [], "client_quality_score": 90}

Example 2 - Company name only, non-technical skills (medium quality):
Job post: "Acme Corporation is seeking a freelance content writer for our blog. SEO experience required. Must be able to research topics and write engaging articles."
Response: {"client_name": "Acme Corporation", "key_skills": ["Content Writing", "SEO", "Research"], "hidden_needs": [], "client_quality_score": 72}

Example 3 - No name, technical skills from implied requirements (medium quality):
Job post: "Need help with Python automation. Must build scripts to scrape websites and process data. Budget $500."
Response: {"client_name": null, "key_skills": ["Python", "Web Scraping", "Data Processing", "Automation"], "hidden_needs": [], "client_quality_score": 68}

Example 4 - Name in sign-off, vague requirements (medium quality):
Job post: "Looking for general help with website updates. Thanks, Michael Rodriguez"
Response: {"client_name": "Michael Rodriguez", "key_skills": ["Web Development"], "hidden_needs": [], "client_quality_score": 65}

Example 5 - No name, no clear skills (low quality):
Job post: "Need someone to help with a project. Good pay. Apply now."
Response: {"client_name": null, "key_skills": [], "hidden_needs": [], "client_quality_score": 55}

Example 6 - Urgency signals detected (low quality):
Job post: "URGENT: Need React developer ASAP for critical bug fixes. Our production site is down and we need someone who can start immediately today. Must have proven experience."
Response: {"client_name": null, "key_skills": ["React", "Bug Fixing", "Production Support"], "hidden_needs": [{"need": "Time-pressured", "evidence": "Mentions 'URGENT', 'ASAP', 'immediately today', and 'production site is down'"}, {"need": "Risk-averse", "evidence": "Requires 'proven experience'"}], "client_quality_score": 52}

Example 7 - Budget and trust concerns (medium quality):
Job post: "Looking for experienced developer for ongoing monthly project. Must provide references and portfolio. Need cost-effective solution. NDA will be required."
Response: {"client_name": null, "key_skills": ["Software Development"], "hidden_needs": [{"need": "Budget-conscious", "evidence": "Emphasizes 'cost-effective solution'"}, {"need": "Risk-averse", "evidence": "Requires 'references and portfolio' and mentions 'NDA'"}, {"need": "Long-term partnership", "evidence": "States 'ongoing monthly project'"}], "client_quality_score": 70}

Example 8 - Generic post with no inferrable needs (medium quality):
Job post: "We are looking for someone to help us with our website. Please apply if interested."
Response: {"client_name": null, "key_skills": ["Web Development"], "hidden_needs": [], "client_quality_score": 65}

Example 9 - "0 hires" client (low quality, hard rule):
Job post: "URGENT!!! Need website ASAP. Very low budget. 0 hires but serious client."
Response: {"client_name": null, "key_skills": ["Web Development"], "hidden_needs": [{"need": "Time-pressured", "evidence": "Mentions 'URGENT!!!' and 'ASAP'"}], "client_quality_score": 45}

Return ONLY valid JSON, no other text."#;

    // Story 4a.9 AC-2: Wrap sanitized content in XML delimiters (AR-13)
    // Story 4b.3: Extended to request client quality score
    let user_message = format!(
        "Analyze this job post and extract the client name, key skills, hidden needs, and client quality score:\n\n<job_post>\n{}\n</job_post>",
        sanitization_result.content
    );

    // AR-5: Enable prompt caching on system prompt with few-shot examples
    let request_body = ClaudeRequest {
        model: HAIKU_MODEL.to_string(),
        max_tokens: 600, // Client name + skills + hidden needs + client quality score
        system: vec![ContentBlock::Text {
            text: system_prompt.to_string(),
            cache_control: Some(CacheControl {
                control_type: "ephemeral".to_string(),
            }),
        }],
        messages: vec![Message {
            role: "user".to_string(),
            content: vec![ContentBlock::Text {
                text: user_message,
                cache_control: None,
            }],
        }],
    };

    let response = client
        .post(ANTHROPIC_API_URL)
        .timeout(Duration::from_secs(5)) // AC-4: <3 seconds target, 5s allows for network latency
        .header("x-api-key", api_key)
        .header("anthropic-version", ANTHROPIC_VERSION)
        .header("anthropic-beta", PROMPT_CACHING_BETA) // AR-5: Enable caching
        .header("content-type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| {
            let error_msg = if e.is_timeout() {
                "Job analysis timed out".to_string()
            } else if e.is_connect() {
                "Unable to reach AI service for analysis".to_string()
            } else {
                format!("Network error during analysis: {}", e)
            };
            tracing::error!("Job analysis failed: {}", error_msg);
            error_msg
        })?;

    let status = response.status();

    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_default();
        if let Ok(error) = serde_json::from_str::<ClaudeError>(&error_text) {
            tracing::error!("Job analysis API error: {}", error.error.message);
            return Err(format!("API error: {}", error.error.message));
        }
        tracing::error!("Job analysis API error ({}): {}", status, error_text);
        return Err(format!("API error ({})", status));
    }

    // Parse response
    let response_json: ClaudeResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse API response: {}", e))?;

    // Extract text from response
    let response_text = response_json
        .content
        .first()
        .and_then(|block| block.text.as_ref())
        .ok_or_else(|| "No content in API response".to_string())?;

    // Parse JSON response (handle potential code block wrapping)
    let json_str = extract_json_from_response(response_text);
    let analysis_response: AnalysisResponse = serde_json::from_str(json_str).map_err(|e| {
        tracing::warn!(
            "Failed to parse job analysis JSON: {}. Response: {}",
            e,
            response_text
        );
        format!("Failed to parse analysis response: {}", e)
    })?;

    // Story 4b.3 AC-3: Apply hard rules for client quality score
    let client_quality_score = apply_client_quality_hard_rules(
        analysis_response.client_quality_score,
        &sanitization_result.content,
    );

    let result = JobAnalysis {
        client_name: analysis_response.client_name,
        key_skills: analysis_response.key_skills,
        hidden_needs: analysis_response.hidden_needs,
        was_truncated,        // Story 4a.9: Include truncation flag
        client_quality_score, // Story 4b.3: Client quality score
        // Story 4b.4: Budget fields populated separately by extract_budget()
        budget_min: None,
        budget_max: None,
        budget_type: "unknown".to_string(),
        // Story 4b.4: Alignment fields populated by calculate_budget_alignment()
        budget_alignment_pct: None,
        budget_alignment_status: "gray".to_string(),
    };

    tracing::info!(
        "Job analysis complete: name={:?}, skills={:?}, hidden_needs={:?}, truncated={}, client_quality={}",
        result.client_name,
        result.key_skills,
        result.hidden_needs,
        result.was_truncated,
        result.client_quality_score.map_or("None".to_string(), |s| s.to_string())
    );

    Ok(result)
}

/// Story 4b.3 AC-3: Apply hard rules for client quality score
/// - "0 hires" explicitly mentioned → force score to 45
/// - No score from LLM → default to 65
/// - Clamp to 0-100 range
fn apply_client_quality_hard_rules(llm_score: Option<i32>, job_post_text: &str) -> Option<i32> {
    // Hard rule: "0 hires" → force score to 45 (AC-3)
    if job_post_text.to_lowercase().contains("0 hires") {
        return Some(45);
    }

    // Default to 65 if LLM returned null/missing (AC-3)
    let score = llm_score.unwrap_or(65);

    // Clamp to valid range
    Some(score.clamp(0, 100))
}

/// Extract JSON from response text (handles code block wrapping)
/// Reused pattern from claude.rs
fn extract_json_from_response(text: &str) -> &str {
    let trimmed = text.trim();
    if let Some(start) = trimmed.find('{') {
        if let Some(end) = trimmed.rfind('}') {
            return &trimmed[start..=end];
        }
    }
    trimmed
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_json_from_response_clean() {
        let input = r#"{"client_name": "John Smith"}"#;
        let result = extract_json_from_response(input);
        assert_eq!(result, r#"{"client_name": "John Smith"}"#);
    }

    #[test]
    fn test_extract_json_from_response_with_whitespace() {
        let input = r#"  {"client_name": null}  "#;
        let result = extract_json_from_response(input);
        assert_eq!(result, r#"{"client_name": null}"#);
    }

    #[test]
    fn test_extract_json_from_response_with_code_blocks() {
        let input = r#"```json
{"client_name": "Acme Corp"}
```"#;
        let result = extract_json_from_response(input);
        assert_eq!(result, r#"{"client_name": "Acme Corp"}"#);
    }

    #[test]
    fn test_job_analysis_serialization() {
        let analysis = JobAnalysis {
            client_name: Some("Test Client".to_string()),
            key_skills: vec!["React".to_string(), "TypeScript".to_string()],
            hidden_needs: vec![],
            was_truncated: false,
            client_quality_score: None,
            budget_min: None,
            budget_max: None,
            budget_type: "unknown".to_string(),
            budget_alignment_pct: None,
            budget_alignment_status: "gray".to_string(),
        };
        let json = serde_json::to_string(&analysis).unwrap();
        assert!(json.contains("clientName")); // camelCase serialization
        assert!(json.contains("keySkills")); // camelCase serialization
        assert!(json.contains("hiddenNeeds")); // camelCase serialization
        assert!(json.contains("budgetType")); // camelCase serialization
        assert!(json.contains("budgetAlignmentPct")); // camelCase serialization
        assert!(json.contains("budgetAlignmentStatus")); // camelCase serialization
    }

    #[test]
    fn test_job_analysis_deserialization() {
        let json = r#"{"clientName": "Sarah Chen", "keySkills": ["React", "Node.js"]}"#;
        let analysis: JobAnalysis = serde_json::from_str(json).unwrap();
        assert_eq!(analysis.client_name, Some("Sarah Chen".to_string()));
        assert_eq!(analysis.key_skills, vec!["React", "Node.js"]);
    }

    #[test]
    fn test_job_analysis_deserialization_missing_skills() {
        // Task 3.6: Verify graceful degradation when key_skills missing
        let json = r#"{"clientName": "John Doe"}"#;
        let analysis: JobAnalysis = serde_json::from_str(json).unwrap();
        assert_eq!(analysis.client_name, Some("John Doe".to_string()));
        assert_eq!(analysis.key_skills, Vec::<String>::new()); // #[serde(default)] provides empty vec
    }

    #[test]
    fn test_analysis_response_parsing_with_skills() {
        // Story 4a.3: Test new response format with key_skills
        let json = r#"{"client_name": "John Doe", "key_skills": ["React", "TypeScript", "API Integration"]}"#;
        let response: AnalysisResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.client_name, Some("John Doe".to_string()));
        assert_eq!(
            response.key_skills,
            vec!["React", "TypeScript", "API Integration"]
        );
    }

    #[test]
    fn test_analysis_response_parsing_empty_skills() {
        // Story 4a.3: Test empty skills array (AC-5)
        let json = r#"{"client_name": null, "key_skills": []}"#;
        let response: AnalysisResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.client_name, None);
        assert_eq!(response.key_skills, Vec::<String>::new());
    }

    #[test]
    fn test_analysis_response_parsing_missing_skills_field() {
        // Task 3.6: Verify default to empty vec if key_skills field missing
        let json = r#"{"client_name": "Jane Smith"}"#;
        let response: AnalysisResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.client_name, Some("Jane Smith".to_string()));
        assert_eq!(response.key_skills, Vec::<String>::new()); // #[serde(default)]
    }

    // ====================
    // Story 4a.4 Tests: Hidden Needs Detection
    // ====================

    #[test]
    fn test_hidden_need_serialization() {
        // Task 6.2: Test HiddenNeed struct serializes correctly
        let need = HiddenNeed {
            need: "Time-pressured".to_string(),
            evidence: "Mentions 'urgent' and 'ASAP'".to_string(),
        };
        let json = serde_json::to_string(&need).unwrap();
        assert!(json.contains("\"need\":\"Time-pressured\""));
        assert!(json.contains("\"evidence\":\"Mentions 'urgent' and 'ASAP'\""));
    }

    #[test]
    fn test_hidden_need_deserialization() {
        // Task 6.2: Test HiddenNeed struct deserializes correctly
        let json = r#"{"need": "Budget-conscious", "evidence": "Emphasizes 'cost-effective'"}"#;
        let need: HiddenNeed = serde_json::from_str(json).unwrap();
        assert_eq!(need.need, "Budget-conscious");
        assert_eq!(need.evidence, "Emphasizes 'cost-effective'");
    }

    #[test]
    fn test_job_analysis_with_hidden_needs() {
        // Task 6.5: Test JobAnalysis includes hidden_needs field
        let analysis = JobAnalysis {
            client_name: Some("Test Client".to_string()),
            key_skills: vec!["React".to_string()],
            hidden_needs: vec![
                HiddenNeed {
                    need: "Time-pressured".to_string(),
                    evidence: "Urgent requirement".to_string(),
                },
                HiddenNeed {
                    need: "Risk-averse".to_string(),
                    evidence: "Requires references".to_string(),
                },
            ],
            was_truncated: false,
            client_quality_score: Some(75),
            budget_alignment_pct: None,
            budget_alignment_status: "gray".to_string(),
            budget_min: None,
            budget_max: None,
            budget_type: "unknown".to_string(),
        };
        let json = serde_json::to_string(&analysis).unwrap();
        assert!(json.contains("hiddenNeeds")); // camelCase serialization
        assert!(json.contains("Time-pressured"));
        assert!(json.contains("Risk-averse"));
    }

    #[test]
    fn test_job_analysis_deserialization_with_hidden_needs() {
        // Task 6.5: Test JobAnalysis deserializes with hidden_needs
        let json = r#"{
            "clientName": "John Doe",
            "keySkills": ["React"],
            "hiddenNeeds": [
                {"need": "Time-pressured", "evidence": "Mentions 'urgent'"}
            ]
        }"#;
        let analysis: JobAnalysis = serde_json::from_str(json).unwrap();
        assert_eq!(analysis.client_name, Some("John Doe".to_string()));
        assert_eq!(analysis.key_skills, vec!["React"]);
        assert_eq!(analysis.hidden_needs.len(), 1);
        assert_eq!(analysis.hidden_needs[0].need, "Time-pressured");
    }

    #[test]
    fn test_job_analysis_missing_hidden_needs_defaults_to_empty() {
        // Task 6.6: Test graceful degradation when hidden_needs missing
        let json = r#"{"clientName": "Jane Smith", "keySkills": ["Python"]}"#;
        let analysis: JobAnalysis = serde_json::from_str(json).unwrap();
        assert_eq!(analysis.client_name, Some("Jane Smith".to_string()));
        assert_eq!(analysis.key_skills, vec!["Python"]);
        assert_eq!(analysis.hidden_needs, Vec::<HiddenNeed>::new()); // #[serde(default)]
    }

    #[test]
    fn test_analysis_response_with_hidden_needs() {
        // Task 6.5: Test AnalysisResponse includes hidden_needs
        let json = r#"{
            "client_name": "Acme Corp",
            "key_skills": ["TypeScript", "React"],
            "hidden_needs": [
                {"need": "Budget-conscious", "evidence": "Cost-effective solution"}
            ]
        }"#;
        let response: AnalysisResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.client_name, Some("Acme Corp".to_string()));
        assert_eq!(response.key_skills, vec!["TypeScript", "React"]);
        assert_eq!(response.hidden_needs.len(), 1);
        assert_eq!(response.hidden_needs[0].need, "Budget-conscious");
    }

    #[test]
    fn test_analysis_response_missing_hidden_needs() {
        // Task 6.6: Test AnalysisResponse defaults to empty vec if hidden_needs missing
        let json = r#"{"client_name": "Test", "key_skills": ["Rust"]}"#;
        let response: AnalysisResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.hidden_needs, Vec::<HiddenNeed>::new());
    }

    #[test]
    fn test_analysis_response_malformed_hidden_needs() {
        // Task 6.7: Test malformed hidden_needs (wrong shape) causes parse error
        // Note: With #[serde(default)], missing/null works, but wrong type should fail
        let json = r#"{"client_name": "Test", "key_skills": [], "hidden_needs": "not an array"}"#;
        let result = serde_json::from_str::<AnalysisResponse>(json);
        assert!(result.is_err()); // Should fail to deserialize
    }

    // ====================
    // Story 4b.3 Tests: Client Quality Score Estimation
    // ====================

    #[test]
    fn test_analysis_response_with_client_quality_score() {
        // Subtask 5.1: Test parsing client_quality_score from response
        let json = r#"{"client_name": "Sarah Chen", "key_skills": ["React"], "hidden_needs": [], "client_quality_score": 90}"#;
        let response: AnalysisResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.client_quality_score, Some(90));
    }

    #[test]
    fn test_analysis_response_missing_client_quality_score() {
        // Subtask 5.5: Test default when client_quality_score missing
        let json = r#"{"client_name": "Test", "key_skills": []}"#;
        let response: AnalysisResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.client_quality_score, None);
    }

    #[test]
    fn test_job_analysis_serialization_with_quality_score() {
        // Subtask 5.1: Test serialization includes clientQualityScore
        let analysis = JobAnalysis {
            client_name: Some("Test".to_string()),
            key_skills: vec![],
            hidden_needs: vec![],
            was_truncated: false,
            client_quality_score: Some(85),
            budget_min: None,
            budget_max: None,
            budget_type: "unknown".to_string(),
            budget_alignment_pct: None,
            budget_alignment_status: "gray".to_string(),
        };
        let json = serde_json::to_string(&analysis).unwrap();
        assert!(json.contains("clientQualityScore"));
        assert!(json.contains("85"));
    }

    #[test]
    fn test_job_analysis_deserialization_with_quality_score() {
        let json = r#"{"clientName": "Test", "clientQualityScore": 72}"#;
        let analysis: JobAnalysis = serde_json::from_str(json).unwrap();
        assert_eq!(analysis.client_quality_score, Some(72));
    }

    #[test]
    fn test_job_analysis_deserialization_missing_quality_score() {
        let json = r#"{"clientName": "Test"}"#;
        let analysis: JobAnalysis = serde_json::from_str(json).unwrap();
        assert_eq!(analysis.client_quality_score, None);
    }

    #[test]
    fn test_hard_rule_zero_hires_forces_45() {
        // Subtask 5.4: "0 hires" hard rule → score forced to 45
        let result = apply_client_quality_hard_rules(
            Some(80),
            "Looking for developer. 0 hires but serious client.",
        );
        assert_eq!(result, Some(45));
    }

    #[test]
    fn test_hard_rule_zero_hires_case_insensitive() {
        let result =
            apply_client_quality_hard_rules(Some(90), "New client with 0 Hires on the platform");
        assert_eq!(result, Some(45));
    }

    #[test]
    fn test_hard_rule_default_65_when_null() {
        // Subtask 5.5: No score from LLM → default 65
        let result = apply_client_quality_hard_rules(None, "Need help with Python project.");
        assert_eq!(result, Some(65));
    }

    #[test]
    fn test_hard_rule_preserves_high_score() {
        // Subtask 5.1: High quality signals → score ≥80 preserved
        let result = apply_client_quality_hard_rules(
            Some(92),
            "Professional job post with verified payment.",
        );
        assert_eq!(result, Some(92));
    }

    #[test]
    fn test_hard_rule_preserves_medium_score() {
        // Subtask 5.2: Medium signals → score 60-79 preserved
        let result = apply_client_quality_hard_rules(
            Some(70),
            "Some job post with reasonable requirements.",
        );
        assert_eq!(result, Some(70));
    }

    #[test]
    fn test_hard_rule_preserves_low_score() {
        // Subtask 5.3: Red flags → score <60 preserved
        let result =
            apply_client_quality_hard_rules(Some(35), "URGENT!!! Very low budget need ASAP.");
        assert_eq!(result, Some(35));
    }

    #[test]
    fn test_hard_rule_clamps_to_100() {
        let result = apply_client_quality_hard_rules(Some(150), "Some job post");
        assert_eq!(result, Some(100));
    }

    #[test]
    fn test_hard_rule_clamps_to_0() {
        let result = apply_client_quality_hard_rules(Some(-10), "Some job post");
        assert_eq!(result, Some(0));
    }

    #[test]
    fn test_hard_rule_contradictory_signals() {
        // Subtask 5.6: Contradictory signals — "0 hires" overrides everything
        let result = apply_client_quality_hard_rules(
            Some(95),
            "100% hire rate but 0 hires. Verified payment.",
        );
        assert_eq!(result, Some(45));
    }

    // ====================
    // Story 4b.4 Tests: Budget Extraction and Alignment
    // ====================

    #[test]
    fn test_budget_info_serialization() {
        // Subtask 9.1: Test BudgetInfo serialization
        let budget = BudgetInfo {
            min: Some(50.0),
            max: Some(75.0),
            budget_type: "hourly".to_string(),
        };
        let json = serde_json::to_string(&budget).unwrap();
        assert!(json.contains("\"min\":50"));
        assert!(json.contains("\"max\":75"));
        assert!(json.contains("\"budget_type\":\"hourly\""));
    }

    #[test]
    fn test_budget_alignment_calculation_hourly_green() {
        // Subtask 9.2: Test hourly job $50 vs user rate $50 → 100%, green
        let budget = BudgetInfo {
            min: Some(50.0),
            max: Some(50.0),
            budget_type: "hourly".to_string(),
        };
        let user_rate = crate::RateConfig {
            hourly_rate: Some(50.0),
            project_rate_min: None,
        };
        let alignment = calculate_budget_alignment(&budget, &user_rate);
        assert_eq!(alignment.percentage, Some(100));
        assert_eq!(alignment.status, "green");
    }

    #[test]
    fn test_budget_alignment_calculation_hourly_red() {
        // Subtask 9.2: Test hourly job $50 vs user rate $75 → 67%, red
        let budget = BudgetInfo {
            min: Some(50.0),
            max: Some(50.0),
            budget_type: "hourly".to_string(),
        };
        let user_rate = crate::RateConfig {
            hourly_rate: Some(75.0),
            project_rate_min: None,
        };
        let alignment = calculate_budget_alignment(&budget, &user_rate);
        assert_eq!(alignment.percentage, Some(66)); // 50/75 = 66.66% → 66
        assert_eq!(alignment.status, "red");
    }

    #[test]
    fn test_budget_alignment_calculation_hourly_above_100() {
        // Subtask 9.2: Test hourly job $50 vs user rate $40 → 125%, green
        let budget = BudgetInfo {
            min: Some(50.0),
            max: Some(50.0),
            budget_type: "hourly".to_string(),
        };
        let user_rate = crate::RateConfig {
            hourly_rate: Some(40.0),
            project_rate_min: None,
        };
        let alignment = calculate_budget_alignment(&budget, &user_rate);
        assert_eq!(alignment.percentage, Some(125));
        assert_eq!(alignment.status, "green");
    }

    #[test]
    fn test_budget_alignment_calculation_fixed_green() {
        // Subtask 9.2: Test fixed job $2000 vs user project min $2000 → 100%, green
        let budget = BudgetInfo {
            min: Some(2000.0),
            max: Some(2000.0),
            budget_type: "fixed".to_string(),
        };
        let user_rate = crate::RateConfig {
            hourly_rate: None,
            project_rate_min: Some(2000.0),
        };
        let alignment = calculate_budget_alignment(&budget, &user_rate);
        assert_eq!(alignment.percentage, Some(100));
        assert_eq!(alignment.status, "green");
    }

    #[test]
    fn test_budget_alignment_calculation_type_mismatch_hourly() {
        // Subtask 9.2: Test hourly job but user has NO hourly rate → mismatch, gray
        let budget = BudgetInfo {
            min: Some(50.0),
            max: Some(50.0),
            budget_type: "hourly".to_string(),
        };
        let user_rate = crate::RateConfig {
            hourly_rate: None,
            project_rate_min: Some(2000.0),
        };
        let alignment = calculate_budget_alignment(&budget, &user_rate);
        assert_eq!(alignment.percentage, None);
        assert_eq!(alignment.status, "mismatch");
    }

    #[test]
    fn test_budget_alignment_calculation_type_mismatch_fixed() {
        // Subtask 9.2: Test fixed job but user has NO project rate → mismatch, gray
        let budget = BudgetInfo {
            min: Some(2000.0),
            max: Some(2000.0),
            budget_type: "fixed".to_string(),
        };
        let user_rate = crate::RateConfig {
            hourly_rate: Some(75.0),
            project_rate_min: None,
        };
        let alignment = calculate_budget_alignment(&budget, &user_rate);
        assert_eq!(alignment.percentage, None);
        assert_eq!(alignment.status, "mismatch");
    }

    #[test]
    fn test_budget_alignment_calculation_unknown_budget() {
        // Subtask 9.2: Test budget unknown → gray, null percentage
        let budget = BudgetInfo {
            min: None,
            max: None,
            budget_type: "unknown".to_string(),
        };
        let user_rate = crate::RateConfig {
            hourly_rate: Some(75.0),
            project_rate_min: Some(2000.0),
        };
        let alignment = calculate_budget_alignment(&budget, &user_rate);
        assert_eq!(alignment.percentage, None);
        assert_eq!(alignment.status, "gray");
    }

    #[test]
    fn test_budget_alignment_calculation_zero_user_rate() {
        // Subtask 9.2: Test user rate = 0 → gray, null percentage
        let budget = BudgetInfo {
            min: Some(50.0),
            max: Some(50.0),
            budget_type: "hourly".to_string(),
        };
        let user_rate = crate::RateConfig {
            hourly_rate: Some(0.0),
            project_rate_min: None,
        };
        let alignment = calculate_budget_alignment(&budget, &user_rate);
        assert_eq!(alignment.percentage, None);
        assert_eq!(alignment.status, "gray");
    }

    #[test]
    fn test_budget_alignment_calculation_yellow() {
        // Subtask 9.2: Test alignment in yellow range (70-99%)
        let budget = BudgetInfo {
            min: Some(60.0),
            max: Some(60.0),
            budget_type: "hourly".to_string(),
        };
        let user_rate = crate::RateConfig {
            hourly_rate: Some(75.0),
            project_rate_min: None,
        };
        let alignment = calculate_budget_alignment(&budget, &user_rate);
        assert_eq!(alignment.percentage, Some(80)); // 60/75 = 80%
        assert_eq!(alignment.status, "yellow");
    }

    #[test]
    fn test_job_analysis_with_budget_fields() {
        // Subtask 9.3: Test JobAnalysis includes budget fields
        let analysis = JobAnalysis {
            client_name: Some("Test".to_string()),
            key_skills: vec![],
            hidden_needs: vec![],
            was_truncated: false,
            client_quality_score: None,
            budget_min: Some(50.0),
            budget_max: Some(75.0),
            budget_type: "hourly".to_string(),
            budget_alignment_pct: Some(80),
            budget_alignment_status: "yellow".to_string(),
        };
        let json = serde_json::to_string(&analysis).unwrap();
        assert!(json.contains("\"budgetMin\":50"));
        assert!(json.contains("\"budgetMax\":75"));
        assert!(json.contains("\"budgetType\":\"hourly\""));
        assert!(json.contains("\"budgetAlignmentPct\":80"));
        assert!(json.contains("\"budgetAlignmentStatus\":\"yellow\""));
    }

    // M2 Fix: Test negative budget edge case
    #[test]
    fn test_budget_alignment_calculation_negative_budget() {
        // Edge case: Negative budget should return gray status
        let budget = BudgetInfo {
            min: Some(-50.0), // Invalid negative budget
            max: Some(-50.0),
            budget_type: "hourly".to_string(),
        };
        let user_rate = crate::RateConfig {
            hourly_rate: Some(75.0),
            project_rate_min: None,
        };
        let alignment = calculate_budget_alignment(&budget, &user_rate);
        assert_eq!(alignment.percentage, None);
        assert_eq!(alignment.status, "gray");
    }

    #[test]
    fn test_budget_alignment_calculation_negative_fixed_budget() {
        // Edge case: Negative fixed budget should return gray status
        let budget = BudgetInfo {
            min: Some(-2000.0), // Invalid negative budget
            max: Some(-2000.0),
            budget_type: "fixed".to_string(),
        };
        let user_rate = crate::RateConfig {
            hourly_rate: None,
            project_rate_min: Some(1500.0),
        };
        let alignment = calculate_budget_alignment(&budget, &user_rate);
        assert_eq!(alignment.percentage, None);
        assert_eq!(alignment.status, "gray");
    }

    // Integration tests with mocked API responses will be added below
}
