import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RecoveryOptions from "./RecoveryOptions";

// Get mocked invoke
const { invoke } = vi.mocked(await import("@tauri-apps/api/core"));

describe("RecoveryOptions", () => {
  const defaultProps = {
    passphrase: "TestPassphrase123!",
    onComplete: vi.fn(),
    onSkip: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Task 6.4: Test RecoveryOptions renders all options
  it("renders all three option cards", () => {
    render(<RecoveryOptions {...defaultProps} />);

    expect(screen.getByText("Protect Your Data - Set Up Recovery")).toBeInTheDocument();
    expect(screen.getByText(/Generate Recovery Key/)).toBeInTheDocument();
    expect(screen.getByText(/Export Unencrypted Backup/)).toBeInTheDocument();
    expect(screen.getByText(/Skip Recovery Setup/)).toBeInTheDocument();
  });

  it("renders warning text (AC1)", () => {
    render(<RecoveryOptions {...defaultProps} />);

    expect(
      screen.getByText(/If you forget your passphrase AND lose your recovery key, your data CANNOT be recovered/)
    ).toBeInTheDocument();
  });

  it("continue button is disabled by default (AC1)", () => {
    render(<RecoveryOptions {...defaultProps} />);

    const continueBtn = screen.getByRole("button", { name: "Continue" });
    expect(continueBtn).toBeDisabled();
  });

  // Task 6.4: Test recovery key generation flow
  it("generates recovery key on button click (AC2)", async () => {
    invoke.mockImplementation((cmd: string) => {
      if (cmd === "generate_recovery_key") {
        return Promise.resolve({
          key: "a7B3kL9mP2qR5sT8uV1wX4yZ6cD0eF2",
          encrypted: "encrypted_data",
        });
      }
      return Promise.resolve(null);
    });

    render(<RecoveryOptions {...defaultProps} />);

    const generateBtn = screen.getByRole("button", { name: "Generate Key" });
    await userEvent.click(generateBtn);

    await waitFor(() => {
      expect(screen.getByText("a7B3kL9mP2qR5sT8uV1wX4yZ6cD0eF2")).toBeInTheDocument();
    });
  });

  // Task 6.4: Test checkbox validation for recovery key
  it("requires checkbox confirmation before continuing (AC2)", async () => {
    invoke.mockImplementation((cmd: string) => {
      if (cmd === "generate_recovery_key") {
        return Promise.resolve({
          key: "a7B3kL9mP2qR5sT8uV1wX4yZ6cD0eF2",
          encrypted: "encrypted_data",
        });
      }
      return Promise.resolve(null);
    });

    render(<RecoveryOptions {...defaultProps} />);

    // Generate key
    await userEvent.click(screen.getByRole("button", { name: "Generate Key" }));

    await waitFor(() => {
      expect(screen.getByText("a7B3kL9mP2qR5sT8uV1wX4yZ6cD0eF2")).toBeInTheDocument();
    });

    // Continue should still be disabled (checkbox not checked)
    const continueBtn = screen.getByRole("button", { name: "Continue" });
    expect(continueBtn).toBeDisabled();

    // Check the confirmation checkbox
    const checkbox = screen.getByRole("checkbox");
    await userEvent.click(checkbox);

    // Now continue should be enabled
    expect(continueBtn).toBeEnabled();
  });

  // Task 6.4: Test skip confirmation modal
  it("shows skip confirmation modal (AC4)", async () => {
    render(<RecoveryOptions {...defaultProps} />);

    const skipBtn = screen.getByRole("button", { name: "Skip" });
    await userEvent.click(skipBtn);

    // Modal should appear
    expect(screen.getByText("Skip Recovery Setup?")).toBeInTheDocument();
    expect(
      screen.getByText(/Without a recovery option, forgotten passphrases CANNOT be recovered/)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go Back and Set Up Recovery" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Skip Anyway" })).toBeInTheDocument();
  });

  it("calls onSkip when Skip Anyway is confirmed (AC4)", async () => {
    render(<RecoveryOptions {...defaultProps} />);

    // Open skip modal
    await userEvent.click(screen.getByRole("button", { name: "Skip" }));

    // Confirm skip
    await userEvent.click(screen.getByRole("button", { name: "Skip Anyway" }));

    expect(defaultProps.onSkip).toHaveBeenCalledTimes(1);
  });

  it("closes skip modal on Go Back (AC4)", async () => {
    render(<RecoveryOptions {...defaultProps} />);

    // Open skip modal
    await userEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(screen.getByText("Skip Recovery Setup?")).toBeInTheDocument();

    // Go back
    await userEvent.click(screen.getByRole("button", { name: "Go Back and Set Up Recovery" }));

    // Modal should be gone
    expect(screen.queryByText("Skip Recovery Setup?")).not.toBeInTheDocument();
  });

  // Task 6.4: Test print dialog triggered
  it("triggers print dialog for recovery key", async () => {
    invoke.mockImplementation((cmd: string) => {
      if (cmd === "generate_recovery_key") {
        return Promise.resolve({
          key: "a7B3kL9mP2qR5sT8uV1wX4yZ6cD0eF2",
          encrypted: "encrypted_data",
        });
      }
      return Promise.resolve(null);
    });

    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});

    render(<RecoveryOptions {...defaultProps} />);

    await userEvent.click(screen.getByRole("button", { name: "Generate Key" }));

    await waitFor(() => {
      expect(screen.getByText("a7B3kL9mP2qR5sT8uV1wX4yZ6cD0eF2")).toBeInTheDocument();
    });

    // Click print button
    const printBtn = screen.getByRole("button", { name: /Print/ });
    await userEvent.click(printBtn);

    expect(printSpy).toHaveBeenCalledTimes(1);
    printSpy.mockRestore();
  });

  it("shows error on generation failure", async () => {
    invoke.mockImplementation((cmd: string) => {
      if (cmd === "generate_recovery_key") {
        return Promise.reject("Generation failed");
      }
      return Promise.resolve(null);
    });

    render(<RecoveryOptions {...defaultProps} />);

    await userEvent.click(screen.getByRole("button", { name: "Generate Key" }));

    await waitFor(() => {
      expect(screen.getByText("Generation failed")).toBeInTheDocument();
    });
  });

  it("calls export_unencrypted_backup on Export Backup click (AC3)", async () => {
    invoke.mockImplementation((cmd: string) => {
      if (cmd === "export_unencrypted_backup") {
        return Promise.resolve({
          success: true,
          filePath: "/Users/test/backup.json",
          message: "Backup saved",
        });
      }
      return Promise.resolve(null);
    });

    render(<RecoveryOptions {...defaultProps} />);

    await userEvent.click(screen.getByRole("button", { name: "Export Backup" }));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("export_unencrypted_backup");
    });

    // Should show success with path
    await waitFor(() => {
      expect(screen.getByText(/\/Users\/test\/backup\.json/)).toBeInTheDocument();
    });
  });
});
