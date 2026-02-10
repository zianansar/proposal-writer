/**
 * Virtualized Job List Component - Story 4b.9 Task 10
 * Uses react-window for efficient rendering of large job lists (NFR-2: <300MB RAM)
 * [AI-Review Fix L1]: Extracted magic numbers to named constants
 */

import { useEffect, useState } from 'react';
import { FixedSizeList } from 'react-window';
import JobCard from './JobCard';
import type { JobQueueItem } from '../types';
import './VirtualizedJobList.css';

interface VirtualizedJobListProps {
  jobs: JobQueueItem[];
}

// Layout constants - adjust these if sidebar/header sizes change
const SIDEBAR_WIDTH = 240; // Account for sidebar and horizontal margins
const HEADER_HEIGHT = 200; // Account for header and controls
const DEFAULT_WIDTH = 1200; // Fallback width for SSR
const DEFAULT_HEIGHT = 800; // Fallback height for SSR

// AC-8: Each job card is 120px tall with 12px margin = 132px total
const JOB_CARD_HEIGHT = 132;
const CARD_VERTICAL_MARGIN = 6; // Half of 12px total margin

export default function VirtualizedJobList({ jobs }: VirtualizedJobListProps) {
  // Use window dimensions for sizing
  const [dimensions, setDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth - SIDEBAR_WIDTH : DEFAULT_WIDTH,
    height: typeof window !== 'undefined' ? window.innerHeight - HEADER_HEIGHT : DEFAULT_HEIGHT,
  });

  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth - SIDEBAR_WIDTH,
        height: window.innerHeight - HEADER_HEIGHT,
      });
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize);
      handleResize(); // Set initial size
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  // Row renderer for react-window
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const job = jobs[index];

    // Add padding to the style to create spacing between cards
    const itemStyle = {
      ...style,
      top: (style.top as number) + CARD_VERTICAL_MARGIN,
      height: (style.height as number) - (CARD_VERTICAL_MARGIN * 2),
      paddingLeft: '2rem',
      paddingRight: '2rem',
    };

    return (
      <div style={itemStyle}>
        <JobCard job={job} />
      </div>
    );
  };

  // If no jobs, show empty state
  if (jobs.length === 0) {
    return null;
  }

  return (
    <div className="virtualized-job-list">
      <FixedSizeList
        height={dimensions.height}
        itemCount={jobs.length}
        itemSize={JOB_CARD_HEIGHT}
        width={dimensions.width}
        itemKey={(index) => jobs[index].id} // AC-10.6: Stable keys for React reconciliation
        overscanCount={3} // Render 3 extra items above/below viewport for smooth scrolling
      >
        {Row}
      </FixedSizeList>
    </div>
  );
}
