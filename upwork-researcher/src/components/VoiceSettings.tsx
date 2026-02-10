import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./VoiceSettings.css";
import {
  VoiceProfile,
  VoiceParameterUpdate,
  DEFAULT_USER_ID,
  VOICE_SAVE_DEBOUNCE_MS,
  DEFAULT_VOICE_PARAMS,
  TONE_LABELS,
  LENGTH_LABELS,
  DEPTH_LABELS,
  getVoiceLabel,
} from "../types/voice";
import {
  VoiceProfileDisplay,
  VoiceLearningTimeline,
  VoiceLearningProgress,
  useProposalsEditedCount,
} from "../features/voice-learning";

// Story 6.2: Manual Voice Parameter Adjustments
// Voice parameters user can manually adjust via sliders

export function VoiceSettings() {
  // State for three manual parameters (use defaults from constants)
  const [toneScore, setToneScore] = useState(DEFAULT_VOICE_PARAMS.tone_score);
  const [lengthPreference, setLengthPreference] = useState(DEFAULT_VOICE_PARAMS.length_preference);
  const [technicalDepth, setTechnicalDepth] = useState(DEFAULT_VOICE_PARAMS.technical_depth);

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Story 8.6: Voice learning progress tracking
  const [hasCalibration, setHasCalibration] = useState(false);
  const { progress: learningProgress, loading: progressLoading, refetch: refetchProgress } = useProposalsEditedCount();

  // Story 8.6 AC-2: Refetch progress when returning from proposal editing
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refetchProgress();
      }
    };

    // Also refetch on window focus (covers tab switching)
    const handleFocus = () => {
      refetchProgress();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [refetchProgress]);

  // Debounce timer
  const timeoutRef = useRef<number | null>(null);

  // AC: Load current voice profile on mount
  useEffect(() => {
    loadProfile();
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const loadProfile = async () => {
    try {
      const profile = await invoke<VoiceProfile | null>("get_voice_profile", {
        userId: DEFAULT_USER_ID,
      });

      if (profile) {
        setToneScore(profile.tone_score);
        setLengthPreference(profile.length_preference);
        setTechnicalDepth(profile.technical_depth);
        setHasCalibration(true); // Story 8.6: Track calibration existence
      } else {
        setHasCalibration(false);
      }
      // If null, keep defaults (5, 5, 5) - AC: handle case where no profile exists
    } catch (err) {
      console.error("Failed to load voice profile:", err);
      setMessage("Failed to load voice settings");
      setHasCalibration(false);
    } finally {
      setLoading(false);
    }
  };

  // AC: Debounced save logic
  const saveWithDebounce = (updates: VoiceParameterUpdate) => {
    setMessage(null);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(async () => {
      setSaving(true);
      try {
        await invoke("update_voice_parameters", {
          userId: DEFAULT_USER_ID,
          params: updates,
        });
        // AC: Show save indicator
        setMessage("✓ Saved");
        setTimeout(() => setMessage(null), 2000);
      } catch (err) {
        console.error("Failed to save voice parameters:", err);
        setMessage(`Failed to save: ${err}`);
      } finally {
        setSaving(false);
      }
    }, VOICE_SAVE_DEBOUNCE_MS);
  };

  const handleToneChange = (value: number) => {
    setToneScore(value);
    saveWithDebounce({ tone_score: value });
  };

  const handleLengthChange = (value: number) => {
    setLengthPreference(value);
    saveWithDebounce({ length_preference: value });
  };

  const handleDepthChange = (value: number) => {
    setTechnicalDepth(value);
    saveWithDebounce({ technical_depth: value });
  };

  if (loading) {
    return <div className="voice-settings-loading">Loading voice settings...</div>;
  }

  return (
    <div className="voice-settings">
      <h3>Voice Settings</h3>

      {/* AC: "Changes will affect future proposals" info text */}
      <p className="voice-settings-info">
        Changes will affect future proposals.
      </p>

      {/* Tone Slider: 1 (Formal) to 10 (Casual) */}
      <div className="voice-slider-group">
        <label htmlFor="tone-slider">
          Tone: {toneScore}/10 {getVoiceLabel(toneScore, TONE_LABELS)}
        </label>
        <div className="slider-container">
          <span className="slider-label-left">Formal</span>
          <input
            id="tone-slider"
            type="range"
            min="1"
            max="10"
            step="0.5"
            value={toneScore}
            onChange={(e) => handleToneChange(parseFloat(e.target.value))}
            aria-label={`Tone: Formal to Casual, currently ${toneScore} out of 10`}
            aria-valuetext={getVoiceLabel(toneScore, TONE_LABELS)}
          />
          <span className="slider-label-right">Casual</span>
        </div>
      </div>

      {/* Length Slider: 1 (Brief) to 10 (Detailed) */}
      <div className="voice-slider-group">
        <label htmlFor="length-slider">
          Length: {lengthPreference}/10 {getVoiceLabel(lengthPreference, LENGTH_LABELS)}
        </label>
        <div className="slider-container">
          <span className="slider-label-left">Brief</span>
          <input
            id="length-slider"
            type="range"
            min="1"
            max="10"
            step="0.5"
            value={lengthPreference}
            onChange={(e) => handleLengthChange(parseFloat(e.target.value))}
            aria-label={`Length: Brief to Detailed, currently ${lengthPreference} out of 10`}
            aria-valuetext={getVoiceLabel(lengthPreference, LENGTH_LABELS)}
          />
          <span className="slider-label-right">Detailed</span>
        </div>
      </div>

      {/* Technical Depth Slider: 1 (Simple) to 10 (Expert) */}
      <div className="voice-slider-group">
        <label htmlFor="depth-slider">
          Technical Depth: {technicalDepth}/10 {getVoiceLabel(technicalDepth, DEPTH_LABELS)}
        </label>
        <div className="slider-container">
          <span className="slider-label-left">Simple</span>
          <input
            id="depth-slider"
            type="range"
            min="1"
            max="10"
            step="0.5"
            value={technicalDepth}
            onChange={(e) => handleDepthChange(parseFloat(e.target.value))}
            aria-label={`Technical Depth: Simple to Expert, currently ${technicalDepth} out of 10`}
            aria-valuetext={getVoiceLabel(technicalDepth, DEPTH_LABELS)}
          />
          <span className="slider-label-right">Expert</span>
        </div>
      </div>

      {/* Save indicator */}
      {(saving || message) && (
        <div className="voice-settings-status" aria-live="polite">
          {saving ? "Saving..." : message}
        </div>
      )}

      {/* Story 8.6: Voice Learning Timeline - Only show after calibration */}
      {hasCalibration && (
        <>
          <VoiceProfileDisplay />
          <VoiceLearningTimeline />
          {!progressLoading && learningProgress && (
            <VoiceLearningProgress progress={learningProgress} />
          )}
        </>
      )}
    </div>
  );
}
