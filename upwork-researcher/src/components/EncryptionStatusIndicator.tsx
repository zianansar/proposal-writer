import { useState, useCallback } from "react";
import "./EncryptionStatusIndicator.css";

export interface EncryptionStatus {
  databaseEncrypted: boolean;
  apiKeyInKeychain: boolean;
  cipherVersion: string;
}

interface EncryptionStatusIndicatorProps {
  status: EncryptionStatus;
  onOpenDetails: () => void;
}

function EncryptionStatusIndicator({ status, onOpenDetails }: EncryptionStatusIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const handleMouseEnter = useCallback(() => {
    setShowTooltip(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setShowTooltip(false);
  }, []);

  const handleClick = useCallback(() => {
    setShowTooltip(false);
    onOpenDetails();
  }, [onOpenDetails]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onOpenDetails();
      }
    },
    [onOpenDetails],
  );

  // Show tooltip on focus for screen readers
  const handleFocus = useCallback(() => {
    setShowTooltip(true);
  }, []);

  const handleBlur = useCallback(() => {
    setShowTooltip(false);
  }, []);

  if (!status.databaseEncrypted) {
    return null;
  }

  const tooltipId = "encryption-tooltip";

  return (
    <div className="encryption-indicator">
      <button
        className="encryption-indicator__button"
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        aria-label="Encryption status: enabled. Data encrypted with AES-256"
        aria-describedby={showTooltip ? tooltipId : undefined}
      >
        <svg
          className="encryption-indicator__icon"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </button>
      {showTooltip && (
        <div id={tooltipId} className="encryption-indicator__tooltip" role="tooltip">
          Data encrypted with AES-256
        </div>
      )}
    </div>
  );
}

export default EncryptionStatusIndicator;
