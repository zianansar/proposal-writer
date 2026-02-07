/// Job analysis module for extracting structured insights from job posts
/// Story 4a.2: Client Name Extraction
/// Extensible design for future analysis fields (4a-3: skills, 4a-4: hidden needs)
/// Story 4a.9: Prompt injection defense via input sanitization

use crate::sanitization::sanitize_job_content;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

const ANTHROPIC_API_URL: &str = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION: &str = "2023-06-01";
const HAIKU_MODEL: &str = "claude-haiku-4-20250514";
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
#[derive(Debug, Deserialize)]
struct AnalysisResponse {
    client_name: Option<String>,
    #[serde(default)]
    key_skills: Vec<String>,
    #[serde(default)]
    hidden_needs: Vec<HiddenNeed>,
}

/// Analyze job post to extract client name and key skills using Claude Haiku
/// Story 4a.2: client_name extraction
/// Story 4a.3: key_skills extraction (3-7 skills)
/// Story 4a.9: Input sanitization with prompt injection defense
/// AC-4: Completes in <3 seconds (Haiku is fast)
/// AR-5: Implements prompt caching for system prompt
/// AR-13: XML delimiter boundaries for job content
pub async fn analyze_job(
    raw_content: &str,
    api_key: &str,
) -> Result<JobAnalysis, String> {
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

    let client = Client::builder()
        .timeout(Duration::from_secs(5)) // AC-4: <3 seconds target, 5s allows for network latency
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    // System prompt with few-shot examples (AR-5: prompt caching enabled)
    // Story 4a.3: Extended to also extract key skills (3-7 skills)
    // Story 4a.4: Extended to extract hidden needs (2-3 implied priorities)
    let system_prompt = r#"You are a job post analyzer. Extract the client's name, key skills, and hidden needs from Upwork job posts.

Return JSON in this exact format:
{
  "client_name": "John Smith",
  "key_skills": ["React", "TypeScript", "API Integration", "Testing"],
  "hidden_needs": [
    {"need": "Client is stressed", "evidence": "They mention 'urgent' and 'ASAP'"},
    {"need": "Budget-conscious", "evidence": "They emphasize 'cost-effective solution'"}
  ]
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

Examples:

Example 1 - Technical job with explicit client:
Job post: "Hi! I'm Sarah Chen, founder of TechStartup Inc. Looking for a React developer to build our dashboard. Must have experience with TypeScript, REST APIs, and unit testing."
Response: {"client_name": "Sarah Chen", "key_skills": ["React", "TypeScript", "REST APIs", "Unit Testing"], "hidden_needs": []}

Example 2 - Company name only, non-technical skills:
Job post: "Acme Corporation is seeking a freelance content writer for our blog. SEO experience required. Must be able to research topics and write engaging articles."
Response: {"client_name": "Acme Corporation", "key_skills": ["Content Writing", "SEO", "Research"], "hidden_needs": []}

Example 3 - No name, technical skills from implied requirements:
Job post: "Need help with Python automation. Must build scripts to scrape websites and process data. Budget $500."
Response: {"client_name": null, "key_skills": ["Python", "Web Scraping", "Data Processing", "Automation"], "hidden_needs": []}

Example 4 - Name in sign-off, vague requirements (minimal skills):
Job post: "Looking for general help with website updates. Thanks, Michael Rodriguez"
Response: {"client_name": "Michael Rodriguez", "key_skills": ["Web Development"], "hidden_needs": []}

Example 5 - No name, no clear skills:
Job post: "Need someone to help with a project. Good pay. Apply now."
Response: {"client_name": null, "key_skills": [], "hidden_needs": []}

Example 6 - Urgency signals detected:
Job post: "URGENT: Need React developer ASAP for critical bug fixes. Our production site is down and we need someone who can start immediately today. Must have proven experience."
Response: {"client_name": null, "key_skills": ["React", "Bug Fixing", "Production Support"], "hidden_needs": [{"need": "Time-pressured", "evidence": "Mentions 'URGENT', 'ASAP', 'immediately today', and 'production site is down'"}, {"need": "Risk-averse", "evidence": "Requires 'proven experience'"}]}

Example 7 - Budget and trust concerns:
Job post: "Looking for experienced developer for ongoing monthly project. Must provide references and portfolio. Need cost-effective solution. NDA will be required."
Response: {"client_name": null, "key_skills": ["Software Development"], "hidden_needs": [{"need": "Budget-conscious", "evidence": "Emphasizes 'cost-effective solution'"}, {"need": "Risk-averse", "evidence": "Requires 'references and portfolio' and mentions 'NDA'"}, {"need": "Long-term partnership", "evidence": "States 'ongoing monthly project'"}]}

Example 8 - Generic post with no inferrable needs:
Job post: "We are looking for someone to help us with our website. Please apply if interested."
Response: {"client_name": null, "key_skills": ["Web Development"], "hidden_needs": []}

Return ONLY valid JSON, no other text."#;

    // Story 4a.9 AC-2: Wrap sanitized content in XML delimiters (AR-13)
    let user_message = format!(
        "Analyze this job post and extract the client name, key skills, and hidden needs:\n\n<job_post>\n{}\n</job_post>",
        sanitization_result.content
    );

    // AR-5: Enable prompt caching on system prompt with few-shot examples
    let request_body = ClaudeRequest {
        model: HAIKU_MODEL.to_string(),
        max_tokens: 500, // Client name + skills array (3-7 skills) + hidden needs (2-3 items)
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
        tracing::error!(
            "Job analysis API error ({}): {}",
            status,
            error_text
        );
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

    let result = JobAnalysis {
        client_name: analysis_response.client_name,
        key_skills: analysis_response.key_skills,
        hidden_needs: analysis_response.hidden_needs,
        was_truncated, // Story 4a.9: Include truncation flag
    };

    tracing::info!(
        "Job analysis complete: name={:?}, skills={:?}, hidden_needs={:?}, truncated={}",
        result.client_name,
        result.key_skills,
        result.hidden_needs,
        result.was_truncated
    );

    Ok(result)
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
        };
        let json = serde_json::to_string(&analysis).unwrap();
        assert!(json.contains("clientName")); // camelCase serialization
        assert!(json.contains("keySkills")); // camelCase serialization
        assert!(json.contains("hiddenNeeds")); // camelCase serialization
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
        assert_eq!(response.key_skills, vec!["React", "TypeScript", "API Integration"]);
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

    // Integration tests with mocked API responses will be added below
}
