// SearchFilterBar component for Story 7.3
// Search input + filter dropdowns for proposal history
import { useCallback, useEffect, useRef, useState } from 'react';
import { OUTCOME_STATUSES } from './useUpdateProposalOutcome';
import { formatLabel } from './OutcomeDropdown';
import type { ProposalFilters } from './useSearchProposals';
import { hasActiveFilters, activeFilterCount, DEFAULT_FILTERS } from './useSearchProposals';
import './SearchFilterBar.css';

const DEBOUNCE_MS = 300;

const DATE_RANGE_OPTIONS = [
  { label: 'All time', value: 0 },
  { label: 'Last 7 days', value: 7 },
  { label: 'Last 30 days', value: 30 },
  { label: 'Last 90 days', value: 90 },
] as const;

interface SearchFilterBarProps {
  filters: ProposalFilters;
  onFilterChange: (filters: ProposalFilters) => void;
  hookStrategies: string[];
  resultCount?: number;
}

export function SearchFilterBar({ filters, onFilterChange, hookStrategies, resultCount }: SearchFilterBarProps) {
  const [inputValue, setInputValue] = useState(filters.searchText);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref to latest filters — prevents stale closure in debounce callback (CR M-1)
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  // Sync input value when filters are cleared externally
  useEffect(() => {
    if (filters.searchText === '' && inputValue !== '') {
      setInputValue('');
    }
  }, [filters.searchText]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setInputValue(value);

      // Debounce the actual filter change
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        onFilterChange({ ...filtersRef.current, searchText: value });
      }, DEBOUNCE_MS);
    },
    [onFilterChange]
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleOutcomeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onFilterChange({ ...filters, outcomeStatus: e.target.value });
    },
    [filters, onFilterChange]
  );

  const handleDateRangeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onFilterChange({ ...filters, dateRangeDays: Number(e.target.value) });
    },
    [filters, onFilterChange]
  );

  const handleHookStrategyChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onFilterChange({ ...filters, hookStrategy: e.target.value });
    },
    [filters, onFilterChange]
  );

  const handleClear = useCallback(() => {
    setInputValue('');
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    onFilterChange(DEFAULT_FILTERS);
  }, [onFilterChange]);

  const isActive = hasActiveFilters(filters);
  const filterCount = activeFilterCount(filters);

  return (
    <div className="search-filter-bar" role="search" aria-label="Filter proposals">
      <div className="search-filter-bar__search">
        <input
          type="search"
          className="search-filter-bar__input"
          placeholder="Search proposals..."
          aria-label="Search proposals by job content or proposal text"
          value={inputValue}
          onChange={handleSearchChange}
        />
      </div>

      <div className="search-filter-bar__filters">
        <select
          className="search-filter-bar__select"
          aria-label="Filter by outcome status"
          value={filters.outcomeStatus}
          onChange={handleOutcomeChange}
        >
          <option value="">All statuses</option>
          {OUTCOME_STATUSES.map((status) => (
            <option key={status} value={status}>
              {formatLabel(status)}
            </option>
          ))}
        </select>

        <select
          className="search-filter-bar__select"
          aria-label="Filter by date range"
          value={filters.dateRangeDays}
          onChange={handleDateRangeChange}
        >
          {DATE_RANGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {hookStrategies.length > 0 && (
          <select
            className="search-filter-bar__select"
            aria-label="Filter by hook strategy"
            value={filters.hookStrategy}
            onChange={handleHookStrategyChange}
          >
            <option value="">All strategies</option>
            {hookStrategies.map((strategy) => (
              <option key={strategy} value={strategy}>
                {formatLabel(strategy)}
              </option>
            ))}
          </select>
        )}

        {isActive && (
          <button
            type="button"
            className="search-filter-bar__clear"
            onClick={handleClear}
            aria-label="Clear all filters"
          >
            Clear filters{filterCount > 0 && ` (${filterCount})`}
          </button>
        )}
      </div>

      {resultCount !== undefined && (
        <div className="search-filter-bar__count" aria-live="polite">
          {isActive
            ? `${resultCount} result${resultCount !== 1 ? 's' : ''} found`
            : `Showing ${resultCount} proposal${resultCount !== 1 ? 's' : ''}`}
        </div>
      )}
    </div>
  );
}
