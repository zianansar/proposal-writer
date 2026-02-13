import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PassphraseUnlock from "./PassphraseUnlock";

// Local invoke mock — overrides global setup.ts mock for precise control
const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

describe("PassphraseUnlock", () => {
  const onUnlocked = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---- Subtask 6.1: Component renders correctly ----

  it("renders the unlock modal with dialog role", () => {
    render(<PassphraseUnlock onUnlocked={onUnlocked} />);

    const dialog = screen.getByRole("dialog", { name: /database unlock/i });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("renders title and subtitle", () => {
    render(<PassphraseUnlock onUnlocked={onUnlocked} />);

    expect(screen.getByText("Unlock Database")).toBeInTheDocument();
    expect(
      screen.getByText(/enter your passphrase to access your encrypted/i)
    ).toBeInTheDocument();
  });

  // ---- Subtask 6.2: Password input field ----

  it("renders password input with type=password by default", () => {
    render(<PassphraseUnlock onUnlocked={onUnlocked} />);

    const input = screen.getByLabelText("Passphrase");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("type", "password");
  });

  it("auto-focuses the passphrase input on mount", async () => {
    render(<PassphraseUnlock onUnlocked={onUnlocked} />);

    await waitFor(() => {
      expect(screen.getByLabelText("Passphrase")).toHaveFocus();
    });
  });

  // ---- Subtask 6.3: Show/hide toggle (AC-7) ----

  it("toggles passphrase visibility when show/hide button clicked", async () => {
    render(<PassphraseUnlock onUnlocked={onUnlocked} />);

    const input = screen.getByLabelText("Passphrase");
    const toggleBtn = screen.getByLabelText("Show passphrase");

    expect(input).toHaveAttribute("type", "password");

    await userEvent.click(toggleBtn);
    expect(input).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Hide passphrase")).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("Hide passphrase"));
    expect(input).toHaveAttribute("type", "password");
  });

  // ---- Subtask 6.4: Submit button ----

  it("renders Unlock button disabled when passphrase is empty", () => {
    render(<PassphraseUnlock onUnlocked={onUnlocked} />);

    const btn = screen.getByRole("button", { name: "Unlock" });
    expect(btn).toBeDisabled();
  });

  it("enables Unlock button when passphrase is entered", async () => {
    render(<PassphraseUnlock onUnlocked={onUnlocked} />);

    await userEvent.type(screen.getByLabelText("Passphrase"), "my-secret");

    const btn = screen.getByRole("button", { name: "Unlock" });
    expect(btn).toBeEnabled();
  });

  // ---- Subtask 6.5: Error message on incorrect passphrase ----

  it("shows error message when passphrase is incorrect", async () => {
    mockInvoke.mockResolvedValueOnce({
      success: false,
      message: "Incorrect passphrase. Try again.",
      failedAttempts: 1,
      showRecovery: false,
    });

    render(<PassphraseUnlock onUnlocked={onUnlocked} />);

    await userEvent.type(screen.getByLabelText("Passphrase"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Unlock" }));

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent("Incorrect passphrase. Try again.");
    });
    expect(onUnlocked).not.toHaveBeenCalled();
  });

  it("clears passphrase input after failed attempt", async () => {
    mockInvoke.mockResolvedValueOnce({
      success: false,
      message: "Incorrect passphrase. Try again.",
      failedAttempts: 1,
      showRecovery: false,
    });

    render(<PassphraseUnlock onUnlocked={onUnlocked} />);

    const input = screen.getByLabelText("Passphrase");
    await userEvent.type(input, "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Unlock" }));

    await waitFor(() => {
      expect(input).toHaveValue("");
    });
  });

  // ---- Subtask 6.6: Attempt counter "Attempt X/5" ----

  it("does not show attempt counter after first failure", async () => {
    mockInvoke.mockResolvedValueOnce({
      success: false,
      message: "Incorrect passphrase. Try again.",
      failedAttempts: 1,
      showRecovery: false,
    });

    render(<PassphraseUnlock onUnlocked={onUnlocked} />);

    await userEvent.type(screen.getByLabelText("Passphrase"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Unlock" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    // Counter only shown for >1 attempts
    expect(screen.queryByText(/Attempt/)).not.toBeInTheDocument();
  });

  it("shows attempt counter 'Attempt 2/5' after second failure", async () => {
    mockInvoke.mockResolvedValueOnce({
      success: false,
      message: "Incorrect passphrase. Try again.",
      failedAttempts: 2,
      showRecovery: false,
    });

    render(<PassphraseUnlock onUnlocked={onUnlocked} />);

    await userEvent.type(screen.getByLabelText("Passphrase"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Unlock" }));

    await waitFor(() => {
      expect(screen.getByText("Attempt 2/5")).toBeInTheDocument();
    });
  });

  it("shows attempt counter 'Attempt 4/5' after fourth failure", async () => {
    mockInvoke.mockResolvedValueOnce({
      success: false,
      message: "Incorrect passphrase. Try again.",
      failedAttempts: 4,
      showRecovery: false,
    });

    render(<PassphraseUnlock onUnlocked={onUnlocked} />);

    await userEvent.type(screen.getByLabelText("Passphrase"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Unlock" }));

    await waitFor(() => {
      expect(screen.getByText("Attempt 4/5")).toBeInTheDocument();
    });
  });

  // ---- Subtask 6.7: Recovery button after 5 failures ----

  it("shows 'Restore from Backup' button after 5 failed attempts", async () => {
    mockInvoke.mockResolvedValueOnce({
      success: false,
      message: "Incorrect passphrase. Try again.",
      failedAttempts: 5,
      showRecovery: true,
    });

    render(<PassphraseUnlock onUnlocked={onUnlocked} />);

    await userEvent.type(screen.getByLabelText("Passphrase"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Unlock" }));

    await waitFor(() => {
      const recoveryBtn = screen.getByRole("button", {
        name: "Restore from Backup",
      });
      expect(recoveryBtn).toBeInTheDocument();
    });
  });

  it("does not show recovery button before 5 failures", async () => {
    mockInvoke.mockResolvedValueOnce({
      success: false,
      message: "Incorrect passphrase. Try again.",
      failedAttempts: 3,
      showRecovery: false,
    });

    render(<PassphraseUnlock onUnlocked={onUnlocked} />);

    await userEvent.type(screen.getByLabelText("Passphrase"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Unlock" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("button", { name: "Restore from Backup" })
    ).not.toBeInTheDocument();
  });

  it("switches to recovery mode when clicking Restore from Backup", async () => {
    mockInvoke.mockResolvedValueOnce({
      success: false,
      message: "Incorrect passphrase. Try again.",
      failedAttempts: 5,
      showRecovery: true,
    });

    render(<PassphraseUnlock onUnlocked={onUnlocked} />);

    await userEvent.type(screen.getByLabelText("Passphrase"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Unlock" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Restore from Backup" })
      ).toBeInTheDocument();
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Restore from Backup" })
    );

    // Should now show recovery key dialog
    expect(
      screen.getByRole("dialog", { name: /recovery key entry/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Recovery Key" })).toBeInTheDocument();
    expect(screen.getByLabelText("Recovery Key")).toBeInTheDocument();
  });

  // ---- Subtask 6.8: Loading state ----

  it("shows loading state during passphrase verification", async () => {
    // Never resolve to keep loading state active
    mockInvoke.mockReturnValue(new Promise(() => {}));

    render(<PassphraseUnlock onUnlocked={onUnlocked} />);

    await userEvent.type(screen.getByLabelText("Passphrase"), "test-pass");
    await userEvent.click(screen.getByRole("button", { name: "Unlock" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Unlocking..." })
      ).toBeDisabled();
    });

    // Input should be disabled during loading
    expect(screen.getByLabelText("Passphrase")).toBeDisabled();
  });

  // ---- Successful unlock flow ----

  it("calls onUnlocked when passphrase is correct", async () => {
    mockInvoke.mockResolvedValueOnce({
      success: true,
      message: "Database unlocked",
      failedAttempts: 0,
      showRecovery: false,
    });

    render(<PassphraseUnlock onUnlocked={onUnlocked} />);

    await userEvent.type(screen.getByLabelText("Passphrase"), "correct-pass");
    await userEvent.click(screen.getByRole("button", { name: "Unlock" }));

    await waitFor(() => {
      expect(onUnlocked).toHaveBeenCalledOnce();
    });
  });

  it("invokes verify_passphrase_on_restart with entered passphrase", async () => {
    mockInvoke.mockResolvedValueOnce({
      success: true,
      message: "Database unlocked",
      failedAttempts: 0,
      showRecovery: false,
    });

    render(<PassphraseUnlock onUnlocked={onUnlocked} />);

    await userEvent.type(screen.getByLabelText("Passphrase"), "my-secret-123");
    await userEvent.click(screen.getByRole("button", { name: "Unlock" }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("verify_passphrase_on_restart", {
        passphrase: "my-secret-123",
      });
    });
  });

  it("submits on Enter key press", async () => {
    mockInvoke.mockResolvedValueOnce({
      success: true,
      message: "Database unlocked",
      failedAttempts: 0,
      showRecovery: false,
    });

    render(<PassphraseUnlock onUnlocked={onUnlocked} />);

    const input = screen.getByLabelText("Passphrase");
    await userEvent.type(input, "my-pass{Enter}");

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("verify_passphrase_on_restart", {
        passphrase: "my-pass",
      });
    });
  });

  // ---- Edge cases ----

  it("does not submit when passphrase is whitespace-only", async () => {
    render(<PassphraseUnlock onUnlocked={onUnlocked} />);

    await userEvent.type(screen.getByLabelText("Passphrase"), "   ");

    const btn = screen.getByRole("button", { name: "Unlock" });
    expect(btn).toBeDisabled();
  });

  it("shows backend error for non-passphrase failures", async () => {
    mockInvoke.mockRejectedValueOnce("Database unlock failed: corrupted");

    render(<PassphraseUnlock onUnlocked={onUnlocked} />);

    await userEvent.type(screen.getByLabelText("Passphrase"), "test");
    await userEvent.click(screen.getByRole("button", { name: "Unlock" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Database unlock failed: corrupted"
      );
    });
  });

  // ---- Recovery mode ----

  it("renders recovery mode with 32-character input", async () => {
    mockInvoke.mockResolvedValueOnce({
      success: false,
      message: "Incorrect passphrase. Try again.",
      failedAttempts: 5,
      showRecovery: true,
    });

    render(<PassphraseUnlock onUnlocked={onUnlocked} />);

    await userEvent.type(screen.getByLabelText("Passphrase"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Unlock" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Restore from Backup" })
      ).toBeInTheDocument();
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Restore from Backup" })
    );

    // Recovery key input shows character count
    expect(screen.getByText("0/32 characters")).toBeInTheDocument();

    // Unlock button disabled until 32 chars
    const unlockBtn = screen.getByRole("button", { name: "Unlock" });
    expect(unlockBtn).toBeDisabled();
  });

  it("filters non-alphanumeric characters in recovery key", async () => {
    mockInvoke.mockResolvedValueOnce({
      success: false,
      message: "Incorrect passphrase. Try again.",
      failedAttempts: 5,
      showRecovery: true,
    });

    render(<PassphraseUnlock onUnlocked={onUnlocked} />);

    await userEvent.type(screen.getByLabelText("Passphrase"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Unlock" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Restore from Backup" })
      ).toBeInTheDocument();
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Restore from Backup" })
    );

    const recoveryInput = screen.getByLabelText("Recovery Key");
    // Type with special chars — only alphanumeric kept
    await userEvent.type(recoveryInput, "abc-123!@#def");
    expect(recoveryInput).toHaveValue("abc123def");
    expect(screen.getByText("9/32 characters")).toBeInTheDocument();
  });

  it("calls unlock_with_recovery_key and transitions to new passphrase mode (TD-2)", async () => {
    mockInvoke
      .mockResolvedValueOnce({
        success: false,
        message: "Incorrect passphrase. Try again.",
        failedAttempts: 5,
        showRecovery: true,
      })
      .mockResolvedValueOnce({
        success: true,
        message: "Unlocked via recovery key",
      });

    render(<PassphraseUnlock onUnlocked={onUnlocked} />);

    await userEvent.type(screen.getByLabelText("Passphrase"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Unlock" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Restore from Backup" })
      ).toBeInTheDocument();
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Restore from Backup" })
    );

    const recoveryInput = screen.getByLabelText("Recovery Key");
    await userEvent.type(recoveryInput, "abcdefghijklmnopqrstuvwxyz012345");

    await userEvent.click(screen.getByRole("button", { name: "Unlock" }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("unlock_with_recovery_key", {
        recoveryKey: "abcdefghijklmnopqrstuvwxyz012345",
      });
    });

    // TD-2: Should transition to new passphrase mode, NOT call onUnlocked
    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: /set new passphrase/i })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Set New Passphrase" })).toBeInTheDocument();
    });
    expect(onUnlocked).not.toHaveBeenCalled();
  });

  it("navigates back from recovery mode to passphrase mode", async () => {
    mockInvoke.mockResolvedValueOnce({
      success: false,
      message: "Incorrect passphrase. Try again.",
      failedAttempts: 5,
      showRecovery: true,
    });

    render(<PassphraseUnlock onUnlocked={onUnlocked} />);

    await userEvent.type(screen.getByLabelText("Passphrase"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Unlock" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Restore from Backup" })
      ).toBeInTheDocument();
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Restore from Backup" })
    );

    expect(
      screen.getByRole("dialog", { name: /recovery key entry/i })
    ).toBeInTheDocument();

    // Click Back
    await userEvent.click(screen.getByRole("button", { name: "Back" }));

    // Should be back to passphrase mode
    expect(
      screen.getByRole("dialog", { name: /database unlock/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Passphrase")).toBeInTheDocument();
  });

  it("shows recovery error on failed recovery attempt", async () => {
    mockInvoke
      .mockResolvedValueOnce({
        success: false,
        message: "Incorrect passphrase. Try again.",
        failedAttempts: 5,
        showRecovery: true,
      })
      .mockRejectedValueOnce("Invalid recovery key");

    render(<PassphraseUnlock onUnlocked={onUnlocked} />);

    await userEvent.type(screen.getByLabelText("Passphrase"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Unlock" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Restore from Backup" })
      ).toBeInTheDocument();
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Restore from Backup" })
    );

    await userEvent.type(
      screen.getByLabelText("Recovery Key"),
      "abcdefghijklmnopqrstuvwxyz012345"
    );
    await userEvent.click(screen.getByRole("button", { name: "Unlock" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Invalid recovery key"
      );
    });
    expect(onUnlocked).not.toHaveBeenCalled();
  });

  // ====================
  // Story TD-2 Tests: New passphrase after recovery
  // ====================

  // Helper: navigate to new passphrase mode
  async function navigateToNewPassphraseMode() {
    mockInvoke
      .mockResolvedValueOnce({
        success: false,
        message: "Incorrect passphrase.",
        failedAttempts: 5,
        showRecovery: true,
      })
      .mockResolvedValueOnce({
        success: true,
        message: "Unlocked via recovery key",
      });

    render(<PassphraseUnlock onUnlocked={onUnlocked} />);

    await userEvent.type(screen.getByLabelText("Passphrase"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Unlock" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Restore from Backup" })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: "Restore from Backup" }));
    await userEvent.type(screen.getByLabelText("Recovery Key"), "abcdefghijklmnopqrstuvwxyz012345");
    await userEvent.click(screen.getByRole("button", { name: "Unlock" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Set New Passphrase" })).toBeInTheDocument();
    });
  }

  it("TD-2: shows new passphrase form with strength meter", async () => {
    await navigateToNewPassphraseMode();

    expect(screen.getByLabelText(/minimum 12 characters/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm Passphrase")).toBeInTheDocument();
    expect(screen.getByText(/recovery successful/i)).toBeInTheDocument();
  });

  it("TD-2: submit button disabled until passphrase meets requirements", async () => {
    await navigateToNewPassphraseMode();

    const submitBtn = screen.getByRole("button", { name: "Set New Passphrase" });
    expect(submitBtn).toBeDisabled();

    const passphraseInput = screen.getByLabelText(/minimum 12 characters/i);
    const confirmInput = screen.getByLabelText("Confirm Passphrase");

    // Type short passphrase
    await userEvent.type(passphraseInput, "short");
    expect(submitBtn).toBeDisabled();

    // Clear and type valid passphrase
    await userEvent.clear(passphraseInput);
    await userEvent.type(passphraseInput, "MyNewSecure123!");
    expect(submitBtn).toBeDisabled(); // Still disabled — no confirmation

    // Type matching confirmation
    await userEvent.type(confirmInput, "MyNewSecure123!");
    expect(submitBtn).toBeEnabled();
  });

  it("TD-2: shows mismatch error when passphrases differ", async () => {
    await navigateToNewPassphraseMode();

    await userEvent.type(screen.getByLabelText(/minimum 12 characters/i), "MyNewSecure123!");
    await userEvent.type(screen.getByLabelText("Confirm Passphrase"), "DifferentPass1!");

    expect(screen.getByText("Passphrases do not match")).toBeInTheDocument();
  });

  it("TD-2: shows strength meter when typing passphrase", async () => {
    await navigateToNewPassphraseMode();

    await userEvent.type(screen.getByLabelText(/minimum 12 characters/i), "MyNewSecure123!");

    expect(screen.getByTestId("strength-meter")).toBeInTheDocument();
    expect(screen.getByText("Strong")).toBeInTheDocument();
  });

  it("TD-2: calls set_new_passphrase_after_recovery on submit", async () => {
    await navigateToNewPassphraseMode();

    // Add mock for set_new_passphrase_after_recovery
    mockInvoke.mockResolvedValueOnce(undefined);

    await userEvent.type(screen.getByLabelText(/minimum 12 characters/i), "MyNewSecure123!");
    await userEvent.type(screen.getByLabelText("Confirm Passphrase"), "MyNewSecure123!");
    await userEvent.click(screen.getByRole("button", { name: "Set New Passphrase" }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("set_new_passphrase_after_recovery", {
        newPassphrase: "MyNewSecure123!",
        recoveryKey: "abcdefghijklmnopqrstuvwxyz012345",
      });
    });
  });

  it("TD-2: shows success message after re-key completes", async () => {
    await navigateToNewPassphraseMode();

    mockInvoke.mockResolvedValueOnce(undefined);

    await userEvent.type(screen.getByLabelText(/minimum 12 characters/i), "MyNewSecure123!");
    await userEvent.type(screen.getByLabelText("Confirm Passphrase"), "MyNewSecure123!");
    await userEvent.click(screen.getByRole("button", { name: "Set New Passphrase" }));

    await waitFor(() => {
      expect(screen.getByText("Passphrase Updated")).toBeInTheDocument();
      expect(screen.getByText(/re-encrypted with the new passphrase/i)).toBeInTheDocument();
    });

    // Continue button transitions to app
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onUnlocked).toHaveBeenCalledOnce();
  });

  it("TD-2: shows error and allows retry on re-key failure", async () => {
    await navigateToNewPassphraseMode();

    mockInvoke.mockRejectedValueOnce("Failed to re-key database: disk full");

    await userEvent.type(screen.getByLabelText(/minimum 12 characters/i), "MyNewSecure123!");
    await userEvent.type(screen.getByLabelText("Confirm Passphrase"), "MyNewSecure123!");
    await userEvent.click(screen.getByRole("button", { name: "Set New Passphrase" }));

    await waitFor(() => {
      expect(screen.getByText(/disk full/i)).toBeInTheDocument();
    });

    // Submit button should still be available for retry
    expect(screen.getByRole("button", { name: "Set New Passphrase" })).toBeEnabled();
    expect(onUnlocked).not.toHaveBeenCalled();
  });

  it("TD-2: shows show/hide toggle in new passphrase mode", async () => {
    await navigateToNewPassphraseMode();

    const input = screen.getByLabelText(/minimum 12 characters/i);
    expect(input).toHaveAttribute("type", "password");

    await userEvent.click(screen.getByLabelText("Show passphrase"));
    expect(input).toHaveAttribute("type", "text");

    // Confirmation field also visible
    expect(screen.getByLabelText("Confirm Passphrase")).toHaveAttribute("type", "text");
  });
});
