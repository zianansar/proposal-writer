import { useEffect, useRef, useCallback } from "react";
import type { EncryptionStatus } from "./EncryptionStatusIndicator";
import "./EncryptionDetailsModal.css";

interface EncryptionDetailsModalProps {
  status: EncryptionStatus;
  onClose: () => void;
}

function EncryptionDetailsModal({
  status,
  onClose,
}: EncryptionDetailsModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Focus close button on mount + body scroll lock
  useEffect(() => {
    closeButtonRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // ESC to close + focus trap (Tab/Shift+Tab cycling)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
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
    [onClose]
  );

  const dbStatus = status.databaseEncrypted
    ? `Encrypted with AES-256 (SQLCipher ${status.cipherVersion})`
    : "Not encrypted";

  const keychainStatus = status.apiKeyInKeychain
    ? "Stored in OS Keychain"
    : "Not in keychain";

  return (
    <div
      ref={backdropRef}
      className="encryption-modal__backdrop"
      onClick={handleBackdropClick}
    >
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
            <span className="encryption-modal__value">
              {status.cipherVersion}
            </span>
          </div>
        </div>

        <div className="encryption-modal__actions">
          <button
            ref={closeButtonRef}
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
