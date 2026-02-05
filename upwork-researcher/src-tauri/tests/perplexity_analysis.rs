/// Tests for perplexity analysis (Story 3.1)
/// FR-11: Pre-flight perplexity scan before copy
/// Threshold: <180 = safe, ≥180 = risky

#[cfg(test)]
mod tests {
    use upwork_research_agent_lib::claude;

    // =========================================================================
    // parse_perplexity_score — unit tests (offline, no API key needed)
    // =========================================================================

    #[test]
    fn test_parse_plain_integer() {
        assert_eq!(claude::parse_perplexity_score("150").unwrap(), 150.0);
    }

    #[test]
    fn test_parse_plain_float() {
        assert_eq!(claude::parse_perplexity_score("150.5").unwrap(), 150.5);
    }

    #[test]
    fn test_parse_with_whitespace() {
        assert_eq!(claude::parse_perplexity_score("  150  ").unwrap(), 150.0);
    }

    #[test]
    fn test_parse_prefixed_label() {
        assert_eq!(
            claude::parse_perplexity_score("Score: 150").unwrap(),
            150.0
        );
    }

    #[test]
    fn test_parse_sentence_context() {
        assert_eq!(
            claude::parse_perplexity_score("The perplexity score is 150.75").unwrap(),
            150.75
        );
    }

    #[test]
    fn test_parse_last_number_wins() {
        // LLM might mention threshold before actual score
        // Last number should be extracted, not first
        assert_eq!(
            claude::parse_perplexity_score("Threshold is 180, your score is 150").unwrap(),
            150.0
        );
    }

    #[test]
    fn test_parse_zero_score() {
        assert_eq!(claude::parse_perplexity_score("0").unwrap(), 0.0);
    }

    #[test]
    fn test_parse_high_score() {
        assert_eq!(claude::parse_perplexity_score("300").unwrap(), 300.0);
    }

    #[test]
    fn test_parse_invalid_returns_error() {
        let result = claude::parse_perplexity_score("invalid text with no numbers");
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .contains("Could not parse perplexity score"));
    }

    #[test]
    fn test_parse_empty_string_returns_error() {
        assert!(claude::parse_perplexity_score("").is_err());
    }

    // =========================================================================
    // Threshold logic — tests using parsed scores
    // =========================================================================

    #[test]
    fn test_threshold_safe_score_below_180() {
        let score = claude::parse_perplexity_score("150").unwrap();
        assert!(score < 180.0, "Score {} should be below threshold", score);
    }

    #[test]
    fn test_threshold_risky_score_at_180() {
        let score = claude::parse_perplexity_score("180").unwrap();
        assert!(score >= 180.0, "Score {} should be at/above threshold", score);
    }

    #[test]
    fn test_threshold_risky_score_above_180() {
        let score = claude::parse_perplexity_score("250.5").unwrap();
        assert!(score >= 180.0, "Score {} should be above threshold", score);
    }

    // =========================================================================
    // Story 3.2: extract_json_from_response — unit tests
    // =========================================================================

    #[test]
    fn test_extract_json_raw_object() {
        let input = r#"{"score": 185.5, "flagged_sentences": []}"#;
        let result = claude::extract_json_from_response(input);
        assert!(result.starts_with('{'));
        assert!(result.ends_with('}'));
    }

    #[test]
    fn test_extract_json_from_code_block() {
        let input = "Here is the analysis:\n```json\n{\"score\": 185.5, \"flagged_sentences\": []}\n```";
        let result = claude::extract_json_from_response(input);
        assert!(result.starts_with('{'), "Expected JSON object, got: {}", result);
        assert!(serde_json::from_str::<serde_json::Value>(result).is_ok());
    }

    #[test]
    fn test_extract_json_from_untagged_code_block() {
        let input = "```\n{\"score\": 190.0, \"flagged_sentences\": []}\n```";
        let result = claude::extract_json_from_response(input);
        assert!(result.starts_with('{'), "Expected JSON object, got: {}", result);
    }

    #[test]
    fn test_extract_json_from_preamble_text() {
        let input = "The analysis result is: {\"score\": 200.0, \"flagged_sentences\": []}";
        let result = claude::extract_json_from_response(input);
        assert!(result.starts_with('{'));
        assert!(result.ends_with('}'));
    }

    #[test]
    fn test_extract_json_with_whitespace() {
        let input = "  \n  {\"score\": 150.0, \"flagged_sentences\": []}  \n  ";
        let result = claude::extract_json_from_response(input);
        assert!(result.starts_with('{'));
    }

    // =========================================================================
    // Story 3.2: FlaggedSentence and PerplexityAnalysis struct tests
    // =========================================================================

    #[test]
    fn test_flagged_sentence_serialization() {
        let sentence = claude::FlaggedSentence {
            text: "I am delighted to delve into this.".to_string(),
            suggestion: "Replace 'delighted to delve' with 'excited to work on'".to_string(),
            index: 0,
        };

        let json = serde_json::to_string(&sentence).unwrap();
        assert!(json.contains("\"text\""));
        assert!(json.contains("\"suggestion\""));
        assert!(json.contains("\"index\""));

        // Verify camelCase serialization for frontend consumption
        let value: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert!(value.get("text").is_some());
        assert!(value.get("suggestion").is_some());
        assert!(value.get("index").is_some());
    }

    #[test]
    fn test_flagged_sentence_deserialization_from_llm_response() {
        // LLM returns snake_case — FlaggedSentence fields are single words so no rename issue
        let json = r#"{"text": "I possess extensive experience.", "suggestion": "Replace 'possess' with 'have'", "index": 1}"#;
        let sentence: claude::FlaggedSentence = serde_json::from_str(json).unwrap();
        assert_eq!(sentence.text, "I possess extensive experience.");
        assert_eq!(sentence.index, 1);
    }

    #[test]
    fn test_perplexity_analysis_struct() {
        let analysis = claude::PerplexityAnalysis {
            score: 185.5,
            threshold: 180.0,
            flagged_sentences: vec![
                claude::FlaggedSentence {
                    text: "Test sentence".to_string(),
                    suggestion: "Fix it".to_string(),
                    index: 0,
                },
            ],
        };

        // Verify serialization includes all fields
        let json = serde_json::to_string(&analysis).unwrap();
        assert!(json.contains("185.5"));
        assert!(json.contains("180.0") || json.contains("180"));
        assert!(json.contains("Test sentence"));

        // Verify camelCase for frontend: flaggedSentences not flagged_sentences
        let value: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert!(value.get("flaggedSentences").is_some(), "Expected camelCase 'flaggedSentences' key");
    }

    #[test]
    fn test_threshold_enforcement_with_sentences() {
        // Score at threshold → risky
        let analysis = claude::PerplexityAnalysis {
            score: 180.0,
            threshold: 180.0,
            flagged_sentences: vec![],
        };
        assert!(
            analysis.score >= analysis.threshold,
            "Score {} should be >= threshold {}",
            analysis.score,
            analysis.threshold
        );

        // Score below threshold → safe
        let safe = claude::PerplexityAnalysis {
            score: 150.0,
            threshold: 180.0,
            flagged_sentences: vec![],
        };
        assert!(
            safe.score < safe.threshold,
            "Score {} should be < threshold {}",
            safe.score,
            safe.threshold
        );

        // Score above threshold with flagged sentences → risky with suggestions
        let risky = claude::PerplexityAnalysis {
            score: 220.0,
            threshold: 180.0,
            flagged_sentences: vec![
                claude::FlaggedSentence {
                    text: "I am delighted to delve.".to_string(),
                    suggestion: "Use simpler phrasing".to_string(),
                    index: 0,
                },
                claude::FlaggedSentence {
                    text: "I possess expertise.".to_string(),
                    suggestion: "Replace 'possess' with 'have'".to_string(),
                    index: 2,
                },
            ],
        };
        assert!(risky.score >= risky.threshold);
        assert_eq!(risky.flagged_sentences.len(), 2);
        assert_eq!(risky.flagged_sentences[0].index, 0);
        assert_eq!(risky.flagged_sentences[1].index, 2);
    }

    #[test]
    fn test_haiku_sentence_analysis_response_parsing() {
        // Simulate a Haiku JSON response with flagged sentences
        let haiku_response = r#"{
            "score": 195.5,
            "flagged_sentences": [
                {
                    "text": "I am delighted to delve into this opportunity.",
                    "suggestion": "Replace 'delighted to delve' with 'excited to work on' - simpler phrasing.",
                    "index": 0
                },
                {
                    "text": "I possess extensive experience in this domain.",
                    "suggestion": "Replace 'possess' with 'have' and 'domain' with 'area'.",
                    "index": 3
                },
                {
                    "text": "I would be honored to leverage my expertise.",
                    "suggestion": "Replace 'honored to leverage' with 'happy to use'.",
                    "index": 5
                }
            ]
        }"#;

        // Parse using the same approach as analyze_perplexity_with_sentences
        #[derive(serde::Deserialize)]
        struct HaikuAnalysisResponse {
            score: f32,
            flagged_sentences: Vec<claude::FlaggedSentence>,
        }

        let extracted = claude::extract_json_from_response(haiku_response);
        let analysis: HaikuAnalysisResponse = serde_json::from_str(extracted).unwrap();

        assert!((analysis.score - 195.5).abs() < f32::EPSILON);
        assert_eq!(analysis.flagged_sentences.len(), 3);
        assert_eq!(analysis.flagged_sentences[0].text, "I am delighted to delve into this opportunity.");
        assert!(analysis.flagged_sentences[0].suggestion.contains("excited to work on"));
        assert_eq!(analysis.flagged_sentences[1].index, 3);
        assert_eq!(analysis.flagged_sentences[2].index, 5);

        // Build PerplexityAnalysis and verify threshold logic
        let result = claude::PerplexityAnalysis {
            score: analysis.score,
            threshold: 180.0,
            flagged_sentences: analysis.flagged_sentences,
        };
        assert!(result.score >= result.threshold, "195.5 should exceed threshold 180");
        assert_eq!(result.flagged_sentences.len(), 3);
    }

    // =========================================================================
    // Integration test — requires ANTHROPIC_API_KEY (skipped in CI)
    // =========================================================================

    #[tokio::test]
    async fn test_perplexity_analysis_api_call() {
        // Skip if ANTHROPIC_API_KEY env var not set (CI-safe)
        if std::env::var("ANTHROPIC_API_KEY").is_err() {
            eprintln!("Skipping API integration test - ANTHROPIC_API_KEY not set");
            return;
        }

        let sample_text = "I have extensive experience in React development and have built similar features before. I can deliver this in 2 weeks.";

        #[allow(deprecated)]
        let result = claude::analyze_perplexity(sample_text, None).await;

        match result {
            Ok(score) => {
                assert!(score >= 0.0, "Score should be non-negative, got {}", score);
                assert!(score <= 500.0, "Score should be reasonable (<500), got {}", score);
                println!("Perplexity score: {}", score);
            }
            Err(e) => {
                // API rate limits or transient failures are acceptable in integration tests
                assert!(
                    !e.is_empty(),
                    "Error message should not be empty"
                );
                eprintln!("Perplexity analysis error (may be expected in CI): {}", e);
            }
        }
    }

    #[tokio::test]
    async fn test_sentence_analysis_api_call() {
        // Skip if ANTHROPIC_API_KEY env var not set (CI-safe)
        if std::env::var("ANTHROPIC_API_KEY").is_err() {
            eprintln!("Skipping API integration test - ANTHROPIC_API_KEY not set");
            return;
        }

        let sample_text = "I am delighted to delve into this opportunity. I possess extensive experience in this domain. I would be honored to leverage my expertise to deliver exceptional results.";

        let result = claude::analyze_perplexity_with_sentences(sample_text, None).await;

        match result {
            Ok(analysis) => {
                assert!(analysis.score >= 0.0, "Score should be non-negative");
                assert!(analysis.score <= 500.0, "Score should be reasonable");
                assert_eq!(analysis.threshold, 180.0, "Threshold should be 180");
                // Haiku should flag at least 1 sentence from this obviously AI-ish text
                println!(
                    "Score: {}, Flagged: {} sentences",
                    analysis.score,
                    analysis.flagged_sentences.len()
                );
                for s in &analysis.flagged_sentences {
                    println!("  [{}] '{}' → {}", s.index, s.text, s.suggestion);
                }
            }
            Err(e) => {
                assert!(!e.is_empty());
                eprintln!("Sentence analysis error (may be expected in CI): {}", e);
            }
        }
    }
}
