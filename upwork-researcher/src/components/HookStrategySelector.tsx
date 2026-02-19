/**
 * Story 5.2: Hook Strategy Selector Component
 *
 * AC-1: Fetch and display 5 hook strategies from database
 * AC-2: Pre-select "Social Proof" strategy by default
 * AC-3: Manage selection state and pass to parent
 * AC-4: Persist selection for next generation (doesn't reset)
 * AC-6: Loading and error states with retry capability
 */

import { invoke } from "@tauri-apps/api/core";
import { useState, useEffect, useRef, useCallback } from "react";

import { useSettings } from "../hooks/useSettings";
import { useStrategySyncListener } from "../hooks/useStrategySyncListener";
import { HookStrategy, parseHookStrategy } from "../types/hooks";

import HookStrategyCard from "./HookStrategyCard";

import "./HookStrategySelector.css";

export interface HookStrategySelectorProps {
  /** Callback when user selects a strategy */
  onSelectionChange: (strategyId: number) => void;
}

export default function HookStrategySelector({ onSelectionChange }: HookStrategySelectorProps) {
  const [strategies, setStrategies] = useState<HookStrategy[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Story 10.5 Task 6.4: "New" badge visibility settings
  const {
    newStrategiesFirstSeen,
    newStrategiesDismissed,
    setNewStrategiesDismissed,
  } = useSettings();

  // AC-5: Refs for arrow key navigation between cards
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // L2 Code Review Fix: Use ref for onSelectionChange to avoid stale closure
  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;

  // AC-1, AC-2, AC-6: Fetch strategies and default to "Social Proof"
  const fetchStrategies = async () => {
    setLoading(true);
    setError(null);

    try {
      // AC-1: Fetch from database via Tauri command
      const result = await invoke<HookStrategy[]>("get_hook_strategies");

      // Defensive check: ensure result is an array (handles null/undefined from mocks)
      if (!Array.isArray(result)) {
        throw new Error("Invalid response: expected array of strategies");
      }

      setStrategies(result);

      // AC-2: Default to "Social Proof" strategy
      const socialProofStrategy = result.find((s) => s.name === "Social Proof");

      if (socialProofStrategy) {
        setSelectedId(socialProofStrategy.id);
        onSelectionChangeRef.current(socialProofStrategy.id);
      } else {
        // Fallback: select first strategy if "Social Proof" not found
        if (import.meta.env.DEV) {
          console.warn('Strategy "Social Proof" not found, defaulting to first strategy');
        }
        if (result.length > 0) {
          setSelectedId(result[0].id);
          onSelectionChangeRef.current(result[0].id);
        }
      }
    } catch (err) {
      // AC-6: Error handling (L4 fix: dev-only logging)
      if (import.meta.env.DEV) {
        console.error("Failed to fetch hook strategies:", err);
      }
      setError("Unable to load hook strategies. Please restart the app.");
    } finally {
      setLoading(false);
    }
  };

  // Story 10.3: AC-6 — refresh strategies list when remote sync completes (Task 5.2)
  useStrategySyncListener({ onSync: fetchStrategies });

  // Fetch strategies on component mount (L2 fix: no eslint-disable needed with ref pattern)
  useEffect(() => {
    fetchStrategies();
  }, []);

  // Story 10.5 Task 6.4: Compute whether a strategy has the "New" badge
  const isStrategyNew = useCallback(
    (strategy: HookStrategy): boolean => {
      if (!strategy.remote_id) return false;
      const firstSeen = newStrategiesFirstSeen[strategy.remote_id];
      if (!firstSeen) return false;
      // Within 7 days?
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - new Date(firstSeen).getTime() > sevenDaysMs) return false;
      // Not dismissed?
      if (newStrategiesDismissed[strategy.remote_id]) return false;
      return true;
    },
    [newStrategiesFirstSeen, newStrategiesDismissed],
  );

  // AC-3: Handle strategy selection
  const handleSelect = (id: number) => {
    setSelectedId(id);
    onSelectionChange(id); // AC-4: Pass to parent

    // Story 10.5 Task 6.5: Dismiss "New" badge on selection
    const strategy = strategies.find((s) => s.id === id);
    if (strategy?.remote_id && newStrategiesFirstSeen[strategy.remote_id]) {
      setNewStrategiesDismissed({
        ...newStrategiesDismissed,
        [strategy.remote_id]: true,
      }).catch(() => {});
    }
  };

  // AC-5: Arrow key navigation handler for radiogroup
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, currentIndex: number) => {
      const cardCount = strategies.length;
      if (cardCount === 0) return;

      let nextIndex: number | null = null;

      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
          e.preventDefault();
          nextIndex = (currentIndex + 1) % cardCount;
          break;
        case "ArrowLeft":
        case "ArrowUp":
          e.preventDefault();
          nextIndex = (currentIndex - 1 + cardCount) % cardCount;
          break;
        default:
          return;
      }

      if (nextIndex !== null && cardRefs.current[nextIndex]) {
        cardRefs.current[nextIndex]?.focus();
      }
    },
    [strategies.length],
  );

  // AC-6: Loading state - skeleton cards
  if (loading) {
    return (
      <div
        className="hook-selector"
        data-testid="hook-selector-loading"
        aria-label="Loading hook strategies"
      >
        <div className="hook-selector__grid">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="hook-card-skeleton" aria-hidden="true">
              <div className="skeleton__header"></div>
              <div className="skeleton__line"></div>
              <div className="skeleton__line"></div>
              <div className="skeleton__line skeleton__line--short"></div>
              <div className="skeleton__tag"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // AC-6: Error state with retry button
  if (error) {
    return (
      <div
        className="hook-selector"
        data-testid="hook-selector-error"
        role="alert"
        aria-live="assertive"
      >
        <div className="hook-selector__error">
          <p className="error__message">{error}</p>
          <button className="error__retry" onClick={fetchStrategies} data-testid="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  // AC-1: Render grid of strategy cards
  return (
    <div
      className="hook-selector"
      data-testid="hook-selector"
      role="radiogroup"
      aria-label="Hook strategies"
    >
      <div className="hook-selector__grid">
        {strategies.map((strategy, index) => {
          const parsed = parseHookStrategy(strategy);
          return (
            <HookStrategyCard
              key={strategy.id}
              ref={(el) => {
                cardRefs.current[index] = el;
              }}
              id={strategy.id}
              name={parsed.name}
              description={parsed.description}
              firstExample={parsed.firstExample}
              bestFor={parsed.best_for}
              isSelected={strategy.id === selectedId}
              onSelect={handleSelect}
              onKeyDown={(e) => handleKeyDown(e, index)}
              status={strategy.status}
              isNew={isStrategyNew(strategy)}
            />
          );
        })}
      </div>
    </div>
  );
}
