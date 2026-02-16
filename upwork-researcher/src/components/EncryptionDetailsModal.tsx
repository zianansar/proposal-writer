import { useEffect, useRef, useCallback } from "react";

import { useFocusTrap } from "../hooks/useFocusTrap";

import type { EncryptionStatus } from "./EncryptionStatusIndicator";
import "./EncryptionDetailsModal.css";

interface EncryptionDetailsModalProps {
  status: EncryptionStatus;
  onClose: () => void;
  /** Story 8.2: Element that triggered the modal (for focus return) */
  triggerRef?: React.RefObject<HTMLElement>;
}

function EncryptionDetailsModal({ status, onClose, triggerRef }: EncryptionDetailsModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Story 8.2: Focus trap for keyboard navigation
  useFocusTrap(modalRef, { triggerRef });

  // Body scroll lock
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // ESC to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Click outside to close
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === backdropRef.current) {
        onClose();
      }
    },
    [onClose],
  );

  const dbStatus = status.databaseEncrypted
    ? `Encrypted with AES-256 (SQLCipher ${status.cipherVersion})`
    : "Not encrypted";

  const keychainStatus = status.apiKeyInKeychain ? "Stored in OS Keychain" : "Not in keychain";

  return (
    <div ref={backdropRef} className="encryption-modal__backdrop" onClick={handleBackdropClick}>
      <div
        ref={modalRef}
        className="encryption-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="encryption-modal-title"
        aria-describedby="encryption-modal-desc"
      >
        <h2 id="encryption-modal-title" className="encryption-modal__title">
          Encryption Status
        </h2>

        <div id="encryption-modal-desc" className="encryption-modal__details">
          <div className="encryption-modal__row">
            <span className="encryption-modal__label">Database:</span>
            <span className="encryption-modal__value">{dbStatus}</span>
          </div>
          <div className="encryption-modal__row">
            <span className="encryption-modal__label">API Key:</span>
            <span className="encryption-modal__value">{keychainStatus}</span>
          </div>
          <div className="encryption-modal__row">
            <span className="encryption-modal__label">Cipher Version:</span>
            <span className="encryption-modal__value">{status.cipherVersion}</span>
          </div>
        </div>

        <div className="encryption-modal__actions">
          <button
            className="encryption-modal__close"
            onClick={onClose}
            aria-label="Close encryption details"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default EncryptionDetailsModal;
