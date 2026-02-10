import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VoiceProfileEmpty } from './VoiceProfileEmpty';

describe('VoiceProfileEmpty', () => {
  it('renders empty state message', () => {
    const mockHandler = vi.fn();
    render(<VoiceProfileEmpty onStartCalibration={mockHandler} />);

    expect(screen.getByText('No voice profile yet')).toBeInTheDocument();
    expect(screen.getByText(/Upload 3-5 of your best past proposals/)).toBeInTheDocument();
    expect(screen.getByText(/This helps the AI match your authentic voice/)).toBeInTheDocument();
  });

  it('renders Start Calibration button', () => {
    const mockHandler = vi.fn();
    render(<VoiceProfileEmpty onStartCalibration={mockHandler} />);

    expect(screen.getByRole('button', { name: /Start Calibration/i })).toBeInTheDocument();
  });

  it('calls onStartCalibration when button is clicked', async () => {
    const mockHandler = vi.fn();
    const user = userEvent.setup();

    render(<VoiceProfileEmpty onStartCalibration={mockHandler} />);

    const button = screen.getByRole('button', { name: /Start Calibration/i });
    await user.click(button);

    expect(mockHandler).toHaveBeenCalledTimes(1);
  });

  it('has correct dark theme styling', () => {
    const mockHandler = vi.fn();
    const { container } = render(<VoiceProfileEmpty onStartCalibration={mockHandler} />);

    // Check for dark theme card background
    const card = container.querySelector('.bg-\\[\\#1e1e1e\\]');
    expect(card).toBeInTheDocument();

    // Check for orange accent button
    const button = screen.getByRole('button', { name: /Start Calibration/i });
    expect(button).toHaveClass('bg-[#f97316]');
  });

  it('icon has aria-hidden for accessibility', () => {
    const mockHandler = vi.fn();
    const { container } = render(<VoiceProfileEmpty onStartCalibration={mockHandler} />);

    const icon = container.querySelector('svg[aria-hidden="true"]');
    expect(icon).toBeInTheDocument();
  });
});
