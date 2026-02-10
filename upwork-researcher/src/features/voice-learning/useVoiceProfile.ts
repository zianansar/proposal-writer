import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { VoiceProfile } from './types';

interface UseVoiceProfileResult {
  profile: VoiceProfile | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useVoiceProfile(): UseVoiceProfileResult {
  const [profile, setProfile] = useState<VoiceProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      // Call Tauri command from Story 5-5b
      const result = await invoke<VoiceProfile | null>('get_voice_profile');
      setProfile(result);
    } catch (err) {
      console.error('Failed to load voice profile:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  return {
    profile,
    loading,
    error,
    refetch: fetchProfile
  };
}
