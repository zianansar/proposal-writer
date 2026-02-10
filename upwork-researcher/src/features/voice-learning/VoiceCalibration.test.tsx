// Voice Calibration Component Tests
// Story 5.4: Task 5.7 - Test UI progress updates

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { VoiceCalibration } from './VoiceCalibration';
import type { CalibrationResult, AnalysisProgress } from './types';

// Mock Tauri API
const mockInvoke = vi.fn();
const mockListen = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: (...args: unknown[]) => mockListen(...args),
}));

describe('VoiceCalibration', () => {
  const mockOnComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Setup listen mock to return unlisten function
    mockListen.mockResolvedValue(() => {});
  });

  it('renders calibrate button initially', () => {
    render(<VoiceCalibration onComplete={mockOnComplete} />);
    expect(screen.getByTestId('calibrate-button')).toBeInTheDocument();
    expect(screen.getByText('Calibrate Voice')).toBeInTheDocument();
  });

  it('shows progress indicator during analysis', async () => {
    // Setup: Mock invoke to return after delay
    mockInvoke.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              profile: {
                tone_score: 6.5,
                avg_sentence_length: 15.2,
                vocabulary_complexity: 9.8,
                structure_preference: { paragraphs_pct: 70, bullets_pct: 30 },
                technical_depth: 7.5,
                common_phrases: ['I have experience with'],
                sample_count: 5,
                calibration_source: 'GoldenSet',
              },
              elapsed_ms: 1200,
              proposals_analyzed: 5,
            });
          }, 100);
        }),
    );

    render(<VoiceCalibration onComplete={mockOnComplete} />);

    // Click calibrate button
    const button = screen.getByTestId('calibrate-button');
    fireEvent.click(button);

    // Button should disappear
    await waitFor(() => {
      expect(screen.queryByTestId('calibrate-button')).not.toBeInTheDocument();
    });
  });

  it('updates progress display as analysis proceeds', async () => {
    // Setup: Capture the listen callback
    type ProgressHandler = (event: { payload: AnalysisProgress }) => void;
    let progressCallback: ProgressHandler | null = null;
    mockListen.mockImplementation(
      (eventName: string, callback: ProgressHandler) => {
        if (eventName === 'analysis_progress') {
          progressCallback = callback;
        }
        return Promise.resolve(() => {});
      },
    );

    // Setup: Mock invoke to wait for manual resolve
    type ResolveHandler = (result: CalibrationResult) => void;
    let resolveInvoke: ResolveHandler | null = null;
    mockInvoke.mockImplementation(
      () =>
        new Promise<CalibrationResult>((resolve) => {
          resolveInvoke = resolve;
        }),
    );

    render(<VoiceCalibration onComplete={mockOnComplete} />);

    // Click calibrate
    fireEvent.click(screen.getByTestId('calibrate-button'));

    // Simulate first progress event (this triggers progress indicator to show)
    // Use non-null assertion since callback is set by mockImplementation before click fires
    const emitProgress = progressCallback!;
    const finishInvoke = resolveInvoke!;

    emitProgress({ payload: { current: 1, total: 5 } });

    // Now wait for progress indicator with first update
    await waitFor(() => {
      expect(screen.getByText(/Analyzing proposals... \(1\/5\)/)).toBeInTheDocument();
    });

    emitProgress({ payload: { current: 3, total: 5 } });
    await waitFor(() => {
      expect(screen.getByText(/Analyzing proposals... \(3\/5\)/)).toBeInTheDocument();
    });

    emitProgress({ payload: { current: 5, total: 5 } });
    await waitFor(() => {
      expect(screen.getByText(/Analyzing proposals... \(5\/5\)/)).toBeInTheDocument();
    });

    // Complete the analysis
    finishInvoke({
      profile: {
        tone_score: 6.5,
        avg_sentence_length: 15.2,
        vocabulary_complexity: 9.8,
        structure_preference: { paragraphs_pct: 70, bullets_pct: 30 },
        technical_depth: 7.5,
        common_phrases: ['I have experience with'],
        sample_count: 5,
        calibration_source: 'GoldenSet',
      },
      elapsed_ms: 1200,
      proposals_analyzed: 5,
    });
  });

  it('shows completion message with elapsed time', async () => {
    // Mock successful calibration
    const mockResult: CalibrationResult = {
      profile: {
        tone_score: 6.5,
        avg_sentence_length: 15.2,
        vocabulary_complexity: 9.8,
        structure_preference: { paragraphs_pct: 70, bullets_pct: 30 },
        technical_depth: 7.5,
        common_phrases: ['I have experience with'],
        sample_count: 5,
        calibration_source: 'GoldenSet',
      },
      elapsed_ms: 1234,
      proposals_analyzed: 5,
    };
    mockInvoke.mockResolvedValue(mockResult);

    render(<VoiceCalibration onComplete={mockOnComplete} />);

    // Click calibrate
    fireEvent.click(screen.getByTestId('calibrate-button'));

    // Wait for completion message
    await waitFor(() => {
      expect(screen.getByTestId('success-message')).toBeInTheDocument();
    });

    // Verify message content (AC-5)
    expect(screen.getByText(/Proposals analyzed locally in 1.2s/)).toBeInTheDocument();
    expect(screen.getByText(/No text was uploaded/)).toBeInTheDocument();
    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('calls onComplete callback with profile', async () => {
    const mockProfile = {
      tone_score: 6.5,
      avg_sentence_length: 15.2,
      vocabulary_complexity: 9.8,
      structure_preference: { paragraphs_pct: 70, bullets_pct: 30 },
      technical_depth: 7.5,
      common_phrases: ['I have experience with'],
      sample_count: 5,
      calibration_source: 'GoldenSet' as const,
    };

    mockInvoke.mockResolvedValue({
      profile: mockProfile,
      elapsed_ms: 1000,
      proposals_analyzed: 5,
    });

    render(<VoiceCalibration onComplete={mockOnComplete} />);

    // Click calibrate
    fireEvent.click(screen.getByTestId('calibrate-button'));

    // Wait for callback
    await waitFor(() => {
      expect(mockOnComplete).toHaveBeenCalledWith(mockProfile);
    });
  });

  it('shows error message on failure', async () => {
    // Mock failed calibration
    mockInvoke.mockRejectedValue('At least 3 proposals required for voice calibration');

    render(<VoiceCalibration onComplete={mockOnComplete} />);

    // Click calibrate
    fireEvent.click(screen.getByTestId('calibrate-button'));

    // Wait for error message
    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toBeInTheDocument();
    });

    expect(
      screen.getByText(/At least 3 proposals required for voice calibration/),
    ).toBeInTheDocument();
  });

  it('invokes calibrate_voice command', async () => {
    mockInvoke.mockResolvedValue({
      profile: {
        tone_score: 5.0,
        avg_sentence_length: 12.0,
        vocabulary_complexity: 8.0,
        structure_preference: { paragraphs_pct: 80, bullets_pct: 20 },
        technical_depth: 5.0,
        common_phrases: [],
        sample_count: 3,
        calibration_source: 'GoldenSet',
      },
      elapsed_ms: 800,
      proposals_analyzed: 3,
    });

    render(<VoiceCalibration onComplete={mockOnComplete} />);

    // Click calibrate
    fireEvent.click(screen.getByTestId('calibrate-button'));

    // Verify invoke was called with correct command
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('calibrate_voice');
    });
  });
});
