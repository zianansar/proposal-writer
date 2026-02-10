/**
 * Job Queue Page - Story 4b.9
 * Main view for displaying sortable, filterable job queue
 */

import { useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useInfiniteJobQueue } from '../hooks/useInfiniteJobQueue';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import JobQueueControls from './JobQueueControls';
import VirtualizedJobList from './VirtualizedJobList';
import type { SortField, ScoreFilter } from '../types';
import './JobQueuePage.css';

export default function JobQueuePage() {
  // AC-8.6: Store sort/filter in URL query params for shareable state
  const [searchParams, setSearchParams] = useSearchParams();

  // Read from URL params, fallback to defaults
  const sortBy = (searchParams.get('sort') as SortField) || 'score';
  const filter = (searchParams.get('filter') as ScoreFilter) || 'all';

  // Validate and sanitize URL params
  useEffect(() => {
    const validSortFields: SortField[] = ['score', 'date', 'clientName'];
    const validFilters: ScoreFilter[] = ['all', 'greenOnly', 'yellowAndGreen'];

    let needsUpdate = false;
    const newParams = new URLSearchParams(searchParams);

    if (!validSortFields.includes(sortBy)) {
      newParams.set('sort', 'score');
      needsUpdate = true;
    }

    if (!validFilters.includes(filter)) {
      newParams.set('filter', 'all');
      needsUpdate = true;
    }

    if (needsUpdate) {
      setSearchParams(newParams, { replace: true });
    }
  }, [sortBy, filter, searchParams, setSearchParams]);

  // Update URL params when sort/filter changes
  const handleSortChange = useCallback((newSort: SortField) => {
    setSearchParams({ sort: newSort, filter });
  }, [filter, setSearchParams]);

  const handleFilterChange = useCallback((newFilter: ScoreFilter) => {
    setSearchParams({ sort: sortBy, filter: newFilter });
  }, [sortBy, setSearchParams]);

  const {
    data: infiniteData,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteJobQueue({ sortBy, filter });

  // Flatten all pages into single jobs array
  const allJobs = useMemo(() => {
    return infiniteData?.pages.flatMap((page) => page.jobs) ?? [];
  }, [infiniteData]);

  // Get color counts from first page (they're consistent across pages)
  const colorCounts = infiniteData?.pages[0]?.colorCounts ?? {
    green: 0,
    yellow: 0,
    red: 0,
    gray: 0,
  };

  // Set up infinite scroll observer
  const observerTarget = useInfiniteScroll({
    hasMore: hasNextPage ?? false,
    isLoading: isFetchingNextPage,
    onLoadMore: () => fetchNextPage(),
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="job-queue-page">
        <div className="job-queue-header">
          <h1>Job Queue</h1>
        </div>
        <div className="job-queue-loading">
          <div className="skeleton-loader">
            <div className="skeleton-line skeleton-title"></div>
            <div className="skeleton-line skeleton-text"></div>
            <div className="skeleton-line skeleton-text"></div>
          </div>
          <div className="skeleton-loader">
            <div className="skeleton-line skeleton-title"></div>
            <div className="skeleton-line skeleton-text"></div>
            <div className="skeleton-line skeleton-text"></div>
          </div>
          <div className="skeleton-loader">
            <div className="skeleton-line skeleton-title"></div>
            <div className="skeleton-line skeleton-text"></div>
            <div className="skeleton-line skeleton-text"></div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="job-queue-page">
        <div className="job-queue-header">
          <h1>Job Queue</h1>
        </div>
        <div className="job-queue-error">
          <div className="error-icon">⚠️</div>
          <h2>Failed to load jobs</h2>
          <p className="error-message">{error instanceof Error ? error.message : String(error)}</p>
          <button onClick={() => refetch()} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Empty state (AC-10)
  // [AI-Review Fix M1]: Differentiate "no jobs" vs "no jobs match filter"
  if (!infiniteData || allJobs.length === 0) {
    const totalCount = infiniteData?.pages[0]?.totalCount ?? 0;
    const hasJobsButFiltered = infiniteData && totalCount === 0 && filter !== 'all';
    const noJobsAtAll = !infiniteData || (totalCount === 0 && filter === 'all');

    // Check if there are jobs in other colors when filtering
    const hasOtherJobs = infiniteData && (
      (filter === 'greenOnly' && (colorCounts.yellow > 0 || colorCounts.red > 0 || colorCounts.gray > 0)) ||
      (filter === 'yellowAndGreen' && (colorCounts.red > 0 || colorCounts.gray > 0))
    );

    return (
      <div className="job-queue-page">
        <div className="job-queue-header">
          <h1>Job Queue</h1>
        </div>
        <div className="job-queue-empty">
          <div className="empty-icon">{hasOtherJobs ? '🔍' : '📋'}</div>
          <h2>{hasOtherJobs ? 'No matching jobs' : 'No jobs in queue'}</h2>
          <p>
            {hasOtherJobs
              ? filter === 'greenOnly'
                ? 'No green-rated jobs found. Try adjusting your filter or improving your skills match.'
                : 'No yellow or green jobs found. Try showing all jobs.'
              : 'Import jobs via RSS or paste manually.'}
          </p>
          {hasOtherJobs ? (
            <button className="import-button" onClick={() => handleFilterChange('all')}>
              Show All Jobs
            </button>
          ) : (
            // [AI-Review Fix M3]: TODO - Wire to RSS import dialog when available
            <button className="import-button" onClick={() => { /* TODO: Open RSS import dialog */ }}>
              Import Jobs
            </button>
          )}
        </div>
      </div>
    );
  }

  // Success state with data
  return (
    <div className="job-queue-page">
      <div className="job-queue-header">
        <h1>Job Queue</h1>
        <JobQueueControls
          sortBy={sortBy}
          filter={filter}
          colorCounts={colorCounts}
          onSortChange={handleSortChange}
          onFilterChange={handleFilterChange}
        />
      </div>

      {/* Job list (AC-1, AC-2, AC-8) - virtualized for performance (NFR-2) */}
      <VirtualizedJobList jobs={allJobs} />

      {/* AC-9: Infinite scroll - observer target loads next page when visible */}
      {hasNextPage && (
        <div className="load-more" ref={observerTarget}>
          {isFetchingNextPage ? (
            <div className="loading-more">
              <span className="loading-spinner">⏳</span>
              <span>Loading more jobs...</span>
            </div>
          ) : (
            <button
              className="load-more-button"
              onClick={() => fetchNextPage()}
              aria-label="Load more jobs"
            >
              Load More
            </button>
          )}
        </div>
      )}
    </div>
  );
}
