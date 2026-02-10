// Tests for ProposalHistoryCard component (Story 8.7)
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { ProposalHistoryCard } from './ProposalHistoryCard';
import type { ProposalListItem } from './types';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('ProposalHistoryCard', () => {
  const mockProposal: ProposalListItem = {
    id: 1,
    jobExcerpt: 'Looking for a React developer',
    previewText: 'I am excited to apply for this position...',
    createdAt: new Date().toISOString(),
  };

  const mockStyle = {
    position: 'absolute' as const,
    top: 0,
    height: 72,
    width: '100%',
  };

  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renders proposal details correctly (AC-1)', () => {
    render(
      <BrowserRouter>
        <ProposalHistoryCard proposal={mockProposal} style={mockStyle} />
      </BrowserRouter>
    );

    expect(screen.getByText('Looking for a React developer')).toBeInTheDocument();
    expect(screen.getByText(/I am excited to apply/)).toBeInTheDocument();
  });

  it('displays relative time for created_at', () => {
    const recentProposal = {
      ...mockProposal,
      createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
    };

    render(
      <BrowserRouter>
        <ProposalHistoryCard proposal={recentProposal} style={mockStyle} />
      </BrowserRouter>
    );

    expect(screen.getByText(/5 minutes ago/)).toBeInTheDocument();
  });

  it('navigates to proposal detail on click', () => {
    render(
      <BrowserRouter>
        <ProposalHistoryCard proposal={mockProposal} style={mockStyle} />
      </BrowserRouter>
    );

    const card = screen.getByRole('button');
    fireEvent.click(card);

    expect(mockNavigate).toHaveBeenCalledWith('/proposal/1');
  });

  it('navigates on Enter key press', () => {
    render(
      <BrowserRouter>
        <ProposalHistoryCard proposal={mockProposal} style={mockStyle} />
      </BrowserRouter>
    );

    const card = screen.getByRole('button');
    fireEvent.keyDown(card, { key: 'Enter' });

    expect(mockNavigate).toHaveBeenCalledWith('/proposal/1');
  });

  it('navigates on Space key press', () => {
    render(
      <BrowserRouter>
        <ProposalHistoryCard proposal={mockProposal} style={mockStyle} />
      </BrowserRouter>
    );

    const card = screen.getByRole('button');
    fireEvent.keyDown(card, { key: ' ' });

    expect(mockNavigate).toHaveBeenCalledWith('/proposal/1');
  });

  it('has correct accessibility attributes', () => {
    render(
      <BrowserRouter>
        <ProposalHistoryCard proposal={mockProposal} style={mockStyle} />
      </BrowserRouter>
    );

    const card = screen.getByRole('button');
    expect(card).toHaveAttribute('tabIndex', '0');
    expect(card).toHaveAttribute('aria-label');
  });

  it('applies correct style prop', () => {
    const { container } = render(
      <BrowserRouter>
        <ProposalHistoryCard proposal={mockProposal} style={mockStyle} />
      </BrowserRouter>
    );

    const card = container.querySelector('.proposal-history-card') as HTMLElement;
    expect(card.style.height).toBe('72px');
  });

  it('handles empty job excerpt', () => {
    const emptyProposal = {
      ...mockProposal,
      jobExcerpt: '',
    };

    render(
      <BrowserRouter>
        <ProposalHistoryCard proposal={emptyProposal} style={mockStyle} />
      </BrowserRouter>
    );

    expect(screen.getByText('Untitled Job')).toBeInTheDocument();
  });

  it('handles empty preview text', () => {
    const emptyPreview = {
      ...mockProposal,
      previewText: '',
    };

    render(
      <BrowserRouter>
        <ProposalHistoryCard proposal={emptyPreview} style={mockStyle} />
      </BrowserRouter>
    );

    expect(screen.getByText('No preview available')).toBeInTheDocument();
  });
});
