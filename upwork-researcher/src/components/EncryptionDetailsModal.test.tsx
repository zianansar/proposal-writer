import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import EncryptionDetailsModal from "./EncryptionDetailsModal";
import type { EncryptionStatus } from "./EncryptionStatusIndicator";

describe("EncryptionDetailsModal", () => {
  const encryptedStatus: EncryptionStatus = {
    databaseEncrypted: true,
    apiKeyInKeychain: true,
    cipherVersion: "4.10.0",
  };

  const partialStatus: EncryptionStatus = {
    databaseEncrypted: true,
    apiKeyInKeychain: false,
    cipherVersion: "4.10.0",
  };

  // Subtask 6.4: modal displays correct encryption details
  it("displays correct encryption details", () => {
    render(
      <EncryptionDetailsModal status={encryptedStatus} onClose={vi.fn()} />
    );

    expect(
      screen.getByRole("heading", { name: /Encryption Status/i })
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Encrypted with AES-256 \(SQLCipher 4\.10\.0\)/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Stored in OS Keychain/i)).toBeInTheDocument();
    expect(screen.getByText("4.10.0")).toBeInTheDocument();
  });

  it("shows not-in-keychain status when API key missing", () => {
    render(
      <EncryptionDetailsModal status={partialStatus} onClose={vi.fn()} />
    );

    expect(screen.getByText(/Not in keychain/i)).toBeInTheDocument();
  });

  // Subtask 6.5: modal closes on "Close" button click
  it("closes on Close button click", () => {
    const onClose = vi.fn();
    render(
      <EncryptionDetailsModal status={encryptedStatus} onClose={onClose} />
    );

    const closeButton = screen.getByRole("button", {
      name: /Close encryption details/i,
    });
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // Subtask 6.6: modal closes on ESC key press
  it("closes on ESC key press", () => {
    const onClose = vi.fn();
    render(
      <EncryptionDetailsModal status={encryptedStatus} onClose={onClose} />
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes when clicking backdrop", () => {
    const onClose = vi.fn();
    const { container } = render(
      <EncryptionDetailsModal status={encryptedStatus} onClose={onClose} />
    );

    const backdrop = container.querySelector(".encryption-modal__backdrop")!;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close when clicking modal content", () => {
    const onClose = vi.fn();
    const { container } = render(
      <EncryptionDetailsModal status={encryptedStatus} onClose={onClose} />
    );

    const modal = container.querySelector(".encryption-modal")!;
    fireEvent.click(modal);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("has correct ARIA attributes", () => {
    render(
      <EncryptionDetailsModal status={encryptedStatus} onClose={vi.fn()} />
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "encryption-modal-title");
    expect(dialog).toHaveAttribute(
      "aria-describedby",
      "encryption-modal-desc"
    );
  });

  it("focuses close button on mount", async () => {
    render(
      <EncryptionDetailsModal status={encryptedStatus} onClose={vi.fn()} />
    );

    const closeButton = screen.getByRole("button", {
      name: /Close encryption details/i,
    });

    // Story 8.2: useFocusTrap uses requestAnimationFrame for focus
    await new Promise(resolve => requestAnimationFrame(() => resolve(undefined)));

    expect(document.activeElement).toBe(closeButton);
  });

  // Review Fix H1: focus trap keeps Tab within modal
  it("traps focus within modal on Tab", async () => {
    render(
      <EncryptionDetailsModal status={encryptedStatus} onClose={vi.fn()} />
    );

    const closeButton = screen.getByRole("button", {
      name: /Close encryption details/i,
    });

    // Story 8.2: Wait for focus trap to initialize
    await new Promise(resolve => requestAnimationFrame(() => resolve(undefined)));

    // Close button is the only focusable element
    // Tab from it should cycle back to itself
    expect(document.activeElement).toBe(closeButton);
    fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(closeButton);
  });

  // Review Fix H1: Shift+Tab also stays trapped
  it("traps focus within modal on Shift+Tab", async () => {
    render(
      <EncryptionDetailsModal status={encryptedStatus} onClose={vi.fn()} />
    );

    // Story 8.2: Wait for focus trap to initialize
    await new Promise(resolve => requestAnimationFrame(() => resolve(undefined)));

    const closeButton = screen.getByRole("button", {
      name: /Close encryption details/i,
    });

    expect(document.activeElement).toBe(closeButton);
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(closeButton);
  });

  // Review Fix M5: body scroll lock
  it("locks body scroll when open and restores on unmount", () => {
    const { unmount } = render(
      <EncryptionDetailsModal status={encryptedStatus} onClose={vi.fn()} />
    );

    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("");
  });
});
