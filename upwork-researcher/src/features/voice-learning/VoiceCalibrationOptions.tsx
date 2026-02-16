// Story 5.7: Voice Calibration Entry Point
// Provides choice between Golden Set (Story 5.3) and Quick Calibration (Story 5.7)

import { useState } from "react";

import { GoldenSetUpload } from "./components/GoldenSetUpload";
import { QuickCalibration } from "./QuickCalibration";
import type { QuickCalibrationAnswers } from "./types";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface VoiceCalibrationOptionsProps {
  /** Callback when calibration completes */
  onComplete: () => void;
  /** If re-calibrating, provides existing answers to pre-populate (AC-6) */
  existingAnswers?: Partial<QuickCalibrationAnswers>;
  /** If user previously used quick calibration (affects recalibration flow) */
  isRecalibration?: boolean;
}

type CalibrationMode = "choice" | "goldenSet" | "quickCalibration";

/**
 * Voice Calibration Options Component
 *
 * # Story 5.7: AC-1, AC-6
 * - AC-1: Show two paths: "Upload Past Proposals" and "Quick Calibration"
 * - AC-6: Allow recalibration with choice between methods
 */
export function VoiceCalibrationOptions({
  onComplete,
  existingAnswers,
  isRecalibration = false,
}: VoiceCalibrationOptionsProps) {
  const [mode, setMode] = useState<CalibrationMode>("choice");

  // AC-1: Show calibration method choice
  if (mode === "choice") {
    return (
      <Card className="bg-[var(--color-bg-primary)] border-[#2a2a2a] max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-[var(--color-text-primary)]">
            {isRecalibration ? "Recalibrate Voice Profile" : "Voice Calibration"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-[var(--color-text-secondary)]">
            Choose how you'd like to calibrate your writing voice:
          </p>

          {/* Option 1: Upload Past Proposals (Golden Set) */}
          <div className="p-4 rounded-lg border border-[#2a2a2a] hover:border-[var(--color-bg-tertiary)] space-y-2">
            <h3 className="text-[var(--color-text-primary)] font-semibold">
              Upload Past Proposals
            </h3>
            <p className="text-[var(--color-text-secondary)] text-sm">
              Upload 3-5 successful proposals for the most accurate voice profile. Analysis happens
              locally - your proposals never leave your device.
            </p>
            <Button
              onClick={() => setMode("goldenSet")}
              className="bg-[#f97316] hover:bg-[#ea580c] text-white mt-3"
              data-testid="upload-proposals-button"
            >
              Upload Proposals
            </Button>
          </div>

          {/* Option 2: Quick Calibration (5 Questions) */}
          <div className="p-4 rounded-lg border border-[#2a2a2a] hover:border-[var(--color-bg-tertiary)] space-y-2">
            <h3 className="text-[var(--color-text-primary)] font-semibold">
              Quick Calibration{" "}
              <span className="text-[var(--color-text-secondary)] font-normal">
                (No uploads needed)
              </span>
            </h3>
            <p className="text-[var(--color-text-secondary)] text-sm">
              Answer 5 quick questions about your writing style. Takes about 30 seconds. Less
              accurate than uploading proposals, but you can start right away.
            </p>
            <Button
              onClick={() => setMode("quickCalibration")}
              variant="outline"
              className="mt-3"
              data-testid="quick-calibration-button"
            >
              Quick Calibration
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show Golden Set Upload UI
  if (mode === "goldenSet") {
    return <GoldenSetUpload onComplete={onComplete} />;
  }

  // Show Quick Calibration UI (AC-6: pre-populate if existing)
  if (mode === "quickCalibration") {
    return <QuickCalibration existingAnswers={existingAnswers} onComplete={onComplete} />;
  }

  return null;
}
