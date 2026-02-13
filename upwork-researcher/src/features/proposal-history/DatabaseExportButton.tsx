// DatabaseExportButton — Encrypted database export with passphrase warning (Story 7.6)

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './DatabaseExportButton.css';

interface ExportArchiveResult {
  success: boolean;
  filePath: string | null;
  fileSizeBytes: number;
  proposalCount: number;
  revisionCount: number;
  jobPostCount: number;
  settingsCount: number;
  voiceProfileCount: number;
  message: string;
}

type ExportState = 'idle' | 'confirming' | 'exporting' | 'success' | 'error';

export function DatabaseExportButton() {
  const [state, setState] = useState<ExportState>('idle');
  const [passphraseHint, setPassphraseHint] = useState('');
  const [result, setResult] = useState<ExportArchiveResult | null>(null);
  const [error, setError] = useState<string>('');

  // Auto-dismiss success/error states after 8 seconds
  useEffect(() => {
    if (state === 'success' || state === 'error') {
      const timer = setTimeout(() => {
        setState('idle');
        setPassphraseHint('');
        setResult(null);
        setError('');
      }, 8000);

      return () => clearTimeout(timer);
    }
  }, [state]);

  const handleExportClick = useCallback(() => {
    setState('confirming');
  }, []);

  const handleCancel = useCallback(() => {
    setState('idle');
    setPassphraseHint('');
  }, []);

  const handleConfirmExport = useCallback(async () => {
    setState('exporting');

    try {
      const exportResult = await invoke<ExportArchiveResult>('export_encrypted_archive', {
        passphraseHint: passphraseHint.trim() || null,
      });

      if (exportResult.success) {
        setResult(exportResult);
        setState('success');
      } else {
        setError(exportResult.message || 'Export failed');
        setState('error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setState('error');
    }
  }, [passphraseHint]);

  const handleTryAgain = useCallback(() => {
    setState('idle');
    setError('');
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  // Idle state
  if (state === 'idle') {
    return (
      <button
        className="database-export-button"
        onClick={handleExportClick}
        aria-label="Export encrypted database backup"
      >
        Export Encrypted Backup
      </button>
    );
  }

  // Confirming state
  if (state === 'confirming') {
    return (
      <div className="database-export-modal-overlay">
        <div className="database-export-modal" role="dialog" aria-labelledby="export-dialog-title">
          <h3 id="export-dialog-title" className="export-dialog-title">
            ⚠ Passphrase Warning
          </h3>

          <p className="export-warning-text">
            This backup is encrypted with your current passphrase. You'll need this passphrase to restore it on this or another machine.
          </p>

          <div className="export-hint-input-group">
            <label htmlFor="passphrase-hint-input" className="export-hint-label">
              Passphrase hint (optional):
            </label>
            <input
              id="passphrase-hint-input"
              type="text"
              className="export-hint-input"
              value={passphraseHint}
              onChange={(e) => setPassphraseHint(e.target.value)}
              placeholder="e.g., My childhood pet's name"
              maxLength={200}
            />
            <span className="export-hint-help-text">
              This hint will be shown if you forget your passphrase. Do NOT enter your actual passphrase.
            </span>
          </div>

          <div className="export-dialog-buttons">
            <button className="export-cancel-button" onClick={handleCancel}>
              Cancel
            </button>
            <button className="export-confirm-button" onClick={handleConfirmExport}>
              Export Backup
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Exporting state
  if (state === 'exporting') {
    return (
      <div className="database-export-status">
        <div className="export-status-content">
          <div className="export-spinner" />
          <span className="export-status-text">Exporting encrypted backup...</span>
        </div>
      </div>
    );
  }

  // Success state
  if (state === 'success' && result) {
    return (
      <div className="database-export-status database-export-success">
        <div className="export-status-content">
          <div className="export-success-icon">✓</div>
          <h4 className="export-status-title">Backup exported successfully!</h4>

          <div className="export-result-details">
            <div className="export-result-row">
              <span className="export-result-label">File:</span>
              <span className="export-result-value" title={result.filePath || ''}>
                {result.filePath ? result.filePath.split(/[/\\]/).pop() : 'N/A'}
              </span>
            </div>

            <div className="export-result-row">
              <span className="export-result-label">Size:</span>
              <span className="export-result-value">{formatFileSize(result.fileSizeBytes)}</span>
            </div>

            <div className="export-result-row export-counts-row">
              <span className="export-result-label">Contents:</span>
              <span className="export-result-value">
                {result.proposalCount} Proposals | {result.revisionCount} Revisions |{' '}
                {result.jobPostCount} Jobs | {result.settingsCount} Settings |{' '}
                {result.voiceProfileCount} Voice Profiles
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (state === 'error') {
    return (
      <div className="database-export-status database-export-error">
        <div className="export-status-content">
          <div className="export-error-icon">✗</div>
          <h4 className="export-status-title">Export failed</h4>
          <p className="export-error-message">{error}</p>
          <button className="export-try-again-button" onClick={handleTryAgain}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return null;
}
