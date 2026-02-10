// Voice Calibration UI Component
// Story 5.4: Task 4 - Build calibration UI component

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import type { VoiceProfile, CalibrationResult, AnalysisProgress } from './types';
import './VoiceCalibration.css';

export interface VoiceCalibrationProps {
  onComplete: (profile: VoiceProfile) => void;
}

/**
 * Voice Calibration Component
 *
 * # Story 5.4: AC-1, AC-4, AC-5
 * - AC-1: Click "Calibrate Voice" → analyzes locally in Rust
 * - AC-4: Show progress: "Analyzing proposals... (3/5)"
 * - AC-5: Show completion: "✓ Proposals analyzed locally in 1.2s. No text was uploaded."
 */
export function VoiceCalibration({ onComplete }: VoiceCalibrationProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const [result, setResult] = useState<CalibrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Task 4.3: Listen to Tauri progress events
  useEffect(() => {
    let unlisten: UnlistenFn | undefined;

    const setupListener = async () => {
      unlisten = await listen<AnalysisProgress>('analysis_progress', (event) => {
        setProgress(event.payload);
      });
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  // Task 4.2: "Calibrate Voice" button handler
  const handleCalibrate = async () => {
    setIsAnalyzing(true);
    setError(null);
    setProgress(null);
    setResult(null);

    try {
      const calibrationResult = await invoke<CalibrationResult>('calibrate_voice');
      setResult(calibrationResult);
      // Task 4.6: Pass results to parent
      onComplete(calibrationResult.profile);
    } catch (err) {
      setError(err as string);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="voice-calibration">
      {/* Task 4.2: Calibrate Voice button */}
      {!result && !isAnalyzing && (
        <button onClick={handleCalibrate} className="primary" data-testid="calibrate-button">
          Calibrate Voice
        </button>
      )}

      {/* Task 4.4: Progress indicator */}
      {isAnalyzing && progress && (
        <div className="progress" data-testid="progress-indicator">
          <div className="spinner" />
          <span>
            Analyzing proposals... ({progress.current}/{progress.total})
          </span>
        </div>
      )}

      {/* Task 4.5: Completion message with elapsed time */}
      {result && (
        <div className="success" data-testid="success-message">
          <span className="checkmark">✓</span>
          <span>
            Proposals analyzed locally in {(result.elapsed_ms / 1000).toFixed(1)}s. No text was
            uploaded.
          </span>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="error" data-testid="error-message">
          Analysis failed: {error}
        </div>
      )}
    </div>
  );
}
