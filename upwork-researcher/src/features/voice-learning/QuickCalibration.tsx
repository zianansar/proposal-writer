// Story 5.7: Quick Calibration Alternative (5 Questions)

import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { QUICK_CALIBRATION_QUESTIONS } from './quickCalibrationQuestions';
import type { QuickCalibrationAnswers } from './types';

interface QuickCalibrationProps {
  existingAnswers?: Partial<QuickCalibrationAnswers>;
  onComplete: () => void;
}

export function QuickCalibration({ existingAnswers, onComplete }: QuickCalibrationProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<QuickCalibrationAnswers>>(existingAnswers || {});
  const [isComplete, setIsComplete] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null); // L1 fix: Error state
  const navigate = useNavigate();
  const dialogRef = useRef<HTMLDivElement>(null); // H2 fix: For focus trap

  const totalSteps = QUICK_CALIBRATION_QUESTIONS.length;
  const currentQuestion = QUICK_CALIBRATION_QUESTIONS[currentStep];
  const currentAnswer = answers[currentQuestion.id as keyof QuickCalibrationAnswers];

  // H2 fix: Focus trap for modal dialog (AC-7)
  useEffect(() => {
    if (isComplete) return; // No trap needed on completion screen

    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusableElements = dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    dialog.addEventListener('keydown', handleKeyDown);
    // Focus first element on mount
    firstElement?.focus();

    return () => dialog.removeEventListener('keydown', handleKeyDown);
  }, [currentStep, isComplete]);

  const handleAnswerChange = useCallback((value: string) => {
    setAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: value,
    }));
    setError(null); // Clear error on new selection
  }, [currentQuestion.id]);

  const handleNext = async () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      // Final step - save profile
      setIsSaving(true);
      setError(null);
      try {
        // TD-5 AC-2: Backend is single source of truth for mapping
        await invoke('quick_calibrate', { answers });
        setIsComplete(true);
      } catch (err) {
        // L1 fix: Show error to user instead of just console.error
        console.error('Failed to save profile:', err);
        setError(typeof err === 'string' ? err : 'Failed to save your preferences. Please try again.');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleStartWriting = () => {
    onComplete();
    navigate('/');
  };

  if (isComplete) {
    return (
      <Card className="bg-[var(--color-bg-primary)] border-[#2a2a2a] max-w-md mx-auto">
        <CardContent className="pt-8 pb-8 text-center">
          {/* L2 fix: Announce completion to screen readers */}
          <div className="sr-only" aria-live="assertive" aria-atomic="true">
            Voice calibration complete. Your writing style preferences are saved.
          </div>
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" aria-hidden="true" />
          <h3 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
            Voice Calibrated!
          </h3>
          <p className="text-[var(--color-text-secondary)] mb-4">
            Your writing style preferences are saved.
          </p>
          <p className="text-sm text-[var(--color-text-secondary)] mb-6">
            For better accuracy, you can upload 3-5 past proposals anytime from Settings.
          </p>
          <Button
            onClick={handleStartWriting}
            className="bg-[#f97316] hover:bg-[#ea580c] text-white"
          >
            Start Writing
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      ref={dialogRef}
      className="bg-[var(--color-bg-primary)] border-[#2a2a2a] max-w-md mx-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="calibration-title"
    >
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-[var(--color-text-primary)]" id="calibration-title">Quick Calibration</CardTitle>
          <span className="text-[var(--color-text-secondary)] text-sm" aria-live="polite" aria-atomic="true">
            Question {currentStep + 1} of {totalSteps}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Screen reader announcement for question change */}
        <div className="sr-only" aria-live="assertive" aria-atomic="true">
          Question {currentStep + 1} of {totalSteps}: {currentQuestion.text}
        </div>

        <p className="text-[var(--color-text-primary)] font-medium" id={`question-${currentStep}`}>
          {currentQuestion.text}
        </p>

        {/* L1 fix: Error display */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-500/50 rounded-lg text-red-400" role="alert">
            <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {/* M3 fix: Removed invalid aria-describedby */}
        <RadioGroup
          value={currentAnswer || ''}
          onValueChange={handleAnswerChange}
          className="space-y-3"
          aria-labelledby={`question-${currentStep}`}
        >
          {currentQuestion.options.map(option => (
            <div
              key={option.value}
              className="flex items-start space-x-3 p-3 rounded-lg border border-[#2a2a2a] hover:border-[var(--color-bg-tertiary)] cursor-pointer"
            >
              <RadioGroupItem
                value={option.value}
                id={option.value}
                className="mt-0.5"
                aria-label={`${option.label}: ${option.description}`}
              />
              <Label htmlFor={option.value} className="cursor-pointer flex-1">
                <span className="text-[var(--color-text-primary)] font-medium">{option.label}</span>
                <span className="text-[var(--color-text-secondary)] text-sm block">
                  {option.description}
                </span>
              </Label>
            </div>
          ))}
        </RadioGroup>

        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 0}
          >
            Back
          </Button>
          <Button
            onClick={handleNext}
            disabled={!currentAnswer || isSaving}
            className="bg-[#f97316] hover:bg-[#ea580c] text-white"
          >
            {currentStep === totalSteps - 1
              ? isSaving
                ? 'Saving...'
                : 'Finish'
              : 'Next'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
