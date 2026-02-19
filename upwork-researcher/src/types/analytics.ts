/**
 * Analytics type definitions for Story 10.4 A/B testing framework.
 *
 * Matches Rust `StrategyEffectivenessData` struct in commands/proposals.rs.
 */

/** Strategy effectiveness data returned by get_strategy_effectiveness command */
export interface StrategyEffectivenessData {
  /** The hook strategy name/key (e.g., 'Social Proof', 'Contrarian') */
  hookStrategyId: string;
  /** true if proposal was A/B assigned, false if manually selected */
  abAssigned: boolean;
  /** Total proposals using this strategy (with this assignment type) */
  total: number;
  /** Count of proposals with positive outcomes (hired, interview, response_received) */
  won: number;
  /** Won / total as percentage in [0.0, 1.0] */
  responseRate: number;
  /** Weighted average outcome score: hired=3, interview=2, response_received=1, else=0 */
  avgScore: number;
}
