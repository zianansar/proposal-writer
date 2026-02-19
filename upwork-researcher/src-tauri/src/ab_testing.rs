//! A/B testing framework for hook strategy weighted random selection.
//!
//! Implements weighted random assignment for proposal hook strategies (Story 10.4).
//! Strategies with ab_weight > 0.0 are eligible for A/B testing; weight 0.0 = inactive.

use crate::db::queries::hook_strategies::HookStrategy;
use rand::Rng;
use thiserror::Error;

/// Errors returned by A/B testing selection (Story 10.4: Task 2.9)
#[derive(Debug, Error, PartialEq)]
pub enum ABTestingError {
    #[error("No active A/B strategies: all weights are 0.0")]
    NoActiveWeights,
}

/// Select a hook strategy via weighted random assignment (Story 10.4: AC-1).
///
/// Filters strategies with ab_weight == 0.0, normalizes remaining weights,
/// then picks one using cumulative probability.
///
/// # Arguments
/// * `strategies` - Slice of HookStrategy from the database (includes ab_weight)
///
/// # Returns
/// * `Ok((hook_strategy_name, ab_weight_at_assignment))` - selected strategy key and original weight
/// * `Err(ABTestingError::NoActiveWeights)` - all weights are 0.0 (AC-6 fallback)
///
/// # Example
/// ```
/// // Strategies: A (0.5), B (0.3), C (0.2), D (0.0)
/// // → D filtered out, A/B/C normalized to [0.5, 0.3, 0.2] (already sum to 1.0)
/// // → random 0.64 lands in B's range [0.5, 0.8) → returns ("b_key", 0.3)
/// ```
pub fn select_hook_strategy_ab(
    strategies: &[HookStrategy],
) -> Result<(String, f32), ABTestingError> {
    select_hook_strategy_ab_with_rng(strategies, &mut rand::thread_rng())
}

/// Internal: accepts an RNG for deterministic testing (Monte Carlo tests use this)
pub fn select_hook_strategy_ab_with_rng<R: Rng>(
    strategies: &[HookStrategy],
    rng: &mut R,
) -> Result<(String, f32), ABTestingError> {
    // Task 2.4: Filter out strategies with ab_weight == 0.0
    let active: Vec<&HookStrategy> = strategies
        .iter()
        .filter(|s| s.ab_weight > 0.0)
        .collect();

    // Task 2.9: All weights are 0.0 → NoActiveWeights error (AC-6 trigger)
    if active.is_empty() {
        return Err(ABTestingError::NoActiveWeights);
    }

    // Task 2.5: Normalize weights so they sum to 1.0
    let total_weight: f64 = active.iter().map(|s| s.ab_weight).sum();
    let normalized: Vec<f64> = active.iter().map(|s| s.ab_weight / total_weight).collect();

    // Task 2.6-2.7: Generate random float in [0.0, 1.0) and walk cumulative distribution
    let r: f64 = rng.gen();
    let mut cumulative = 0.0_f64;

    for (i, &norm_weight) in normalized.iter().enumerate() {
        cumulative += norm_weight;
        if r < cumulative {
            // Task 2.8: Return strategy display name as hook_strategy_id.
            // Matches manual selection path which also stores name. (CR M-3: intentional)
            return Ok((active[i].name.clone(), active[i].ab_weight as f32));
        }
    }

    // Floating point edge case: r is very close to 1.0 — select the last active strategy
    let last = active.last().unwrap();
    Ok((last.name.clone(), last.ab_weight as f32))
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::{SeedableRng, rngs::StdRng};

    fn make_strategy(name: &str, ab_weight: f64) -> HookStrategy {
        HookStrategy {
            id: 1,
            name: name.to_string(),
            description: String::new(),
            examples_json: "[]".to_string(),
            best_for: String::new(),
            created_at: String::new(),
            status: "active".to_string(),
            remote_id: None,
            ab_weight,
        }
    }

    // Task 2.10: 8+ unit tests

    #[test]
    fn test_single_strategy_always_selected() {
        // Single strategy with weight 1.0 → always selected
        let strategies = vec![make_strategy("social_proof", 1.0)];
        for _ in 0..100 {
            let result = select_hook_strategy_ab(&strategies).unwrap();
            assert_eq!(result.0, "social_proof");
            assert!((result.1 - 1.0_f32).abs() < 1e-6);
        }
    }

    #[test]
    fn test_all_zero_weights_returns_no_active_error() {
        // Task 2.9: All weights 0.0 → NoActiveWeights error (AC-6 fallback)
        let strategies = vec![
            make_strategy("a", 0.0),
            make_strategy("b", 0.0),
            make_strategy("c", 0.0),
        ];
        assert_eq!(
            select_hook_strategy_ab(&strategies).unwrap_err(),
            ABTestingError::NoActiveWeights
        );
    }

    #[test]
    fn test_empty_strategies_returns_no_active_error() {
        // Empty slice → NoActiveWeights error
        let strategies: Vec<HookStrategy> = vec![];
        assert_eq!(
            select_hook_strategy_ab(&strategies).unwrap_err(),
            ABTestingError::NoActiveWeights
        );
    }

    #[test]
    fn test_zero_weight_strategy_never_selected() {
        // Task 2.4: Strategy with weight 0.0 is never selected
        let strategies = vec![
            make_strategy("active_a", 0.5),
            make_strategy("zero_b", 0.0),
            make_strategy("active_c", 0.5),
        ];
        for _ in 0..200 {
            let result = select_hook_strategy_ab(&strategies).unwrap();
            assert_ne!(
                result.0, "zero_b",
                "zero-weight strategy should never be selected"
            );
        }
    }

    #[test]
    fn test_normalization_two_strategies() {
        // Task 2.5: Weights [0.5, 0.3] normalize to [0.625, 0.375]
        // Monte Carlo: over 10,000 trials verify distribution
        let strategies = vec![
            make_strategy("a", 0.5),
            make_strategy("b", 0.3),
        ];

        let mut rng = StdRng::seed_from_u64(42);
        let trials = 10_000;
        let mut count_a = 0usize;
        let mut count_b = 0usize;

        for _ in 0..trials {
            match select_hook_strategy_ab_with_rng(&strategies, &mut rng).unwrap().0.as_str() {
                "a" => count_a += 1,
                "b" => count_b += 1,
                _ => panic!("Unexpected strategy"),
            }
        }

        // Expected: a ≈ 62.5%, b ≈ 37.5% (±5%)
        let rate_a = count_a as f64 / trials as f64;
        let rate_b = count_b as f64 / trials as f64;
        assert!(
            (rate_a - 0.625).abs() < 0.05,
            "Strategy A rate {:.3} should be near 62.5%",
            rate_a
        );
        assert!(
            (rate_b - 0.375).abs() < 0.05,
            "Strategy B rate {:.3} should be near 37.5%",
            rate_b
        );
    }

    #[test]
    fn test_equal_weights_monte_carlo() {
        // Equal weights [0.25, 0.25, 0.25, 0.25] → each ~25% ±5%
        let strategies = vec![
            make_strategy("a", 0.25),
            make_strategy("b", 0.25),
            make_strategy("c", 0.25),
            make_strategy("d", 0.25),
        ];

        let mut rng = StdRng::seed_from_u64(123);
        let trials = 10_000;
        let mut counts = std::collections::HashMap::new();

        for _ in 0..trials {
            let name = select_hook_strategy_ab_with_rng(&strategies, &mut rng)
                .unwrap()
                .0;
            *counts.entry(name).or_insert(0usize) += 1;
        }

        for (name, count) in &counts {
            let rate = *count as f64 / trials as f64;
            assert!(
                (rate - 0.25).abs() < 0.05,
                "Strategy {} rate {:.3} should be near 25%",
                name,
                rate
            );
        }
    }

    #[test]
    fn test_skewed_weights_monte_carlo() {
        // Skewed weights [0.7, 0.2, 0.1] → distribution matches
        let strategies = vec![
            make_strategy("heavy", 0.7),
            make_strategy("medium", 0.2),
            make_strategy("light", 0.1),
        ];

        let mut rng = StdRng::seed_from_u64(456);
        let trials = 10_000;
        let mut counts = std::collections::HashMap::new();

        for _ in 0..trials {
            let name = select_hook_strategy_ab_with_rng(&strategies, &mut rng)
                .unwrap()
                .0;
            *counts.entry(name).or_insert(0usize) += 1;
        }

        let rate_heavy = counts.get("heavy").copied().unwrap_or(0) as f64 / trials as f64;
        let rate_medium = counts.get("medium").copied().unwrap_or(0) as f64 / trials as f64;
        let rate_light = counts.get("light").copied().unwrap_or(0) as f64 / trials as f64;

        assert!(
            (rate_heavy - 0.7).abs() < 0.05,
            "Heavy rate {:.3} should be near 70%",
            rate_heavy
        );
        assert!(
            (rate_medium - 0.2).abs() < 0.05,
            "Medium rate {:.3} should be near 20%",
            rate_medium
        );
        assert!(
            (rate_light - 0.1).abs() < 0.05,
            "Light rate {:.3} should be near 10%",
            rate_light
        );
    }

    #[test]
    fn test_original_weight_returned_not_normalized() {
        // Task 2.8: Returns original (non-normalized) weight for recording in proposals
        // Weights [0.5, 0.3] normalize to [0.625, 0.375] but original [0.5, 0.3] returned
        let strategies = vec![
            make_strategy("a", 0.5),
            make_strategy("b", 0.3),
        ];

        let mut rng = StdRng::seed_from_u64(789);
        let trials = 1_000;
        for _ in 0..trials {
            let (name, weight) = select_hook_strategy_ab_with_rng(&strategies, &mut rng).unwrap();
            match name.as_str() {
                "a" => assert!(
                    (weight - 0.5_f32).abs() < 1e-5,
                    "Strategy 'a' should return original weight 0.5, got {}",
                    weight
                ),
                "b" => assert!(
                    (weight - 0.3_f32).abs() < 1e-5,
                    "Strategy 'b' should return original weight 0.3, got {}",
                    weight
                ),
                _ => panic!("Unexpected strategy: {}", name),
            }
        }
    }

    #[test]
    fn test_weights_that_dont_sum_to_one_normalized_correctly() {
        // Weights [3.0, 1.0] → normalized [0.75, 0.25] (AC-1: weights normalized)
        let strategies = vec![
            make_strategy("a", 3.0),
            make_strategy("b", 1.0),
        ];

        // Even weights > 1.0 should work (normalization handles it)
        let mut rng = StdRng::seed_from_u64(999);
        let trials = 5_000;
        let mut count_a = 0usize;

        for _ in 0..trials {
            if select_hook_strategy_ab_with_rng(&strategies, &mut rng)
                .unwrap()
                .0
                == "a"
            {
                count_a += 1;
            }
        }

        let rate_a = count_a as f64 / trials as f64;
        assert!(
            (rate_a - 0.75).abs() < 0.05,
            "Strategy A rate {:.3} should be near 75% after normalization",
            rate_a
        );
    }
}
