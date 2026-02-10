// Story 8.6: React hook for managing proposals edited count
// Provides progress tracking for voice learning timeline

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getVoiceLearningStatus, VoiceLearningProgress } from './types';

export function useProposalsEditedCount() {
  const [progress, setProgress] = useState<VoiceLearningProgress | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCount = async () => {
    try {
      setLoading(true);
      const count = await invoke<number>('get_proposals_edited_count');
      setProgress(getVoiceLearningStatus(count));
    } catch (err) {
      console.error('Failed to fetch proposals edited count:', err);
    } finally {
      setLoading(false);
    }
  };

  const incrementCount = async () => {
    try {
      const newCount = await invoke<number>('increment_proposals_edited');
      setProgress(getVoiceLearningStatus(newCount));
    } catch (err) {
      console.error('Failed to increment proposals edited count:', err);
    }
  };

  useEffect(() => {
    fetchCount();
  }, []);

  return { progress, loading, refetch: fetchCount, incrementCount };
}
