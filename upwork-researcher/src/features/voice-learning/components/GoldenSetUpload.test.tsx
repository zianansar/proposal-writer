// Story 5.3: Golden Set Upload UI Tests

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { GoldenSetUpload } from "./GoldenSetUpload";

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

describe("GoldenSetUpload", () => {
  const mockOnComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: return empty proposals list
    mockInvoke.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // AC-1: Upload interface rendering
  it("renders upload interface with file picker and paste area", async () => {
    render(<GoldenSetUpload onComplete={mockOnComplete} />);

    await waitFor(() => {
      expect(screen.getByText("Upload Your Best Proposals")).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Upload 3-5 of your best proposals that got responses/i)
    ).toBeInTheDocument();

    expect(screen.getByRole("button", { name: /Upload proposal file/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Paste your proposal text here...")).toBeInTheDocument();
  });

  // AC-3: Text paste area
  it("allows pasting proposal text", async () => {
    render(<GoldenSetUpload onComplete={mockOnComplete} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Paste your proposal text here...")).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText("Paste your proposal text here...");

    fireEvent.change(textarea, {
      target: { value: "Test proposal text with many words. ".repeat(20) },
    });

    expect(textarea).toHaveValue("Test proposal text with many words. ".repeat(20));
  });

  // AC-4: Word count display
  it("shows real-time word count", async () => {
    render(<GoldenSetUpload onComplete={mockOnComplete} />);

    await waitFor(() => {
      expect(screen.getByText(/Word count: 0/i)).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText("Paste your proposal text here...");

    // Type some text (10 words)
    fireEvent.change(textarea, {
      target: { value: "one two three four five six seven eight nine ten" },
    });

    expect(screen.getByText(/Word count: 10/i)).toBeInTheDocument();
  });

  // AC-4: Word count validation - below minimum
  it("shows error when word count is below 200", async () => {
    render(<GoldenSetUpload onComplete={mockOnComplete} />);

    await waitFor(() => {
      expect(screen.getByText(/Word count: 0/i)).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText("Paste your proposal text here...");

    // Type 150 words
    fireEvent.change(textarea, {
      target: { value: "word ".repeat(150) },
    });

    expect(screen.getByText(/minimum 200 required/i)).toBeInTheDocument();
  });

  // AC-4: Add button disabled when below minimum
  it("disables Add Proposal button when below 200 words", async () => {
    render(<GoldenSetUpload onComplete={mockOnComplete} />);

    await waitFor(() => {
      const addButton = screen.getByRole("button", { name: /Add Proposal/i });
      expect(addButton).toBeDisabled();
    });

    const textarea = screen.getByPlaceholderText("Paste your proposal text here...");

    // Type 150 words (below minimum)
    fireEvent.change(textarea, {
      target: { value: "word ".repeat(150) },
    });

    const addButton = screen.getByRole("button", { name: /Add Proposal/i });
    expect(addButton).toBeDisabled();
  });

  // AC-3: Add proposal from paste
  it("adds proposal when paste text is valid", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_golden_proposals_command") {
        return Promise.resolve([
          {
            id: 1,
            content: "word ".repeat(200),
            word_count: 200,
            source_filename: null,
            created_at: "2024-01-01",
          },
        ]);
      }
      if (cmd === "add_golden_proposal_command") {
        return Promise.resolve(1);
      }
      return Promise.resolve([]);
    });

    render(<GoldenSetUpload onComplete={mockOnComplete} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Paste your proposal text here...")).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText("Paste your proposal text here...");

    // Type 200 words
    const validText = "word ".repeat(200);
    fireEvent.change(textarea, { target: { value: validText } });

    const addButton = screen.getByRole("button", { name: /Add Proposal/i });
    expect(addButton).toBeEnabled();

    fireEvent.click(addButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("add_golden_proposal_command", {
        content: validText,
        sourceFilename: null,
      });
    });

    // AC-3: Textarea should be cleared after successful add
    await waitFor(() => {
      expect(textarea).toHaveValue("");
    });
  });

  // AC-5: Progress counter
  it("shows progress counter", async () => {
    mockInvoke.mockResolvedValue([
      {
        id: 1,
        content: "word ".repeat(200),
        word_count: 200,
        source_filename: "test.txt",
        created_at: "2024-01-01",
      },
      {
        id: 2,
        content: "word ".repeat(200),
        word_count: 200,
        source_filename: null,
        created_at: "2024-01-02",
      },
    ]);

    render(<GoldenSetUpload onComplete={mockOnComplete} />);

    await waitFor(() => {
      expect(screen.getByText(/2\/5 proposals uploaded/i)).toBeInTheDocument();
      expect(screen.getByText(/minimum 3 required/i)).toBeInTheDocument();
    });
  });

  // AC-5: Uploaded proposal list
  it("shows uploaded proposal list with previews", async () => {
    mockInvoke.mockResolvedValue([
      {
        id: 1,
        content: "This is a test proposal with some content that will be truncated",
        word_count: 11,
        source_filename: "proposal.txt",
        created_at: "2024-01-01",
      },
    ]);

    render(<GoldenSetUpload onComplete={mockOnComplete} />);

    await waitFor(() => {
      expect(screen.getByText(/This is a test proposal with some content that/i)).toBeInTheDocument();
      expect(screen.getByText(/11 words/i)).toBeInTheDocument();
      expect(screen.getByText(/proposal\.txt/i)).toBeInTheDocument();
    });
  });

  // AC-5: Delete button
  it("deletes proposal when delete button is clicked", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_golden_proposals_command") {
        // First call returns 1 proposal, second call returns empty
        if (mockInvoke.mock.calls.filter((c) => c[0] === "get_golden_proposals_command").length === 1) {
          return Promise.resolve([
            {
              id: 1,
              content: "word ".repeat(200),
              word_count: 200,
              source_filename: "test.txt",
              created_at: "2024-01-01",
            },
          ]);
        }
        return Promise.resolve([]);
      }
      if (cmd === "delete_golden_proposal_command") {
        return Promise.resolve();
      }
      return Promise.resolve([]);
    });

    render(<GoldenSetUpload onComplete={mockOnComplete} />);

    await waitFor(() => {
      expect(screen.getByText(/test\.txt/i)).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole("button", { name: /Delete proposal: test\.txt/i });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("delete_golden_proposal_command", { id: 1 });
    });
  });

  // AC-5: Continue button enabled when 3+ proposals
  it("enables Continue button when 3+ proposals uploaded", async () => {
    mockInvoke.mockResolvedValue([
      { id: 1, content: "word ".repeat(200), word_count: 200, source_filename: "1.txt", created_at: "2024-01-01" },
      { id: 2, content: "word ".repeat(200), word_count: 200, source_filename: "2.txt", created_at: "2024-01-02" },
      { id: 3, content: "word ".repeat(200), word_count: 200, source_filename: "3.txt", created_at: "2024-01-03" },
    ]);

    render(<GoldenSetUpload onComplete={mockOnComplete} />);

    await waitFor(() => {
      const continueButton = screen.getByRole("button", { name: /Continue to Calibration/i });
      expect(continueButton).toBeEnabled();
    });
  });

  // AC-5: Continue button disabled when < 3 proposals
  it("disables Continue button when < 3 proposals", async () => {
    mockInvoke.mockResolvedValue([
      { id: 1, content: "word ".repeat(200), word_count: 200, source_filename: "1.txt", created_at: "2024-01-01" },
    ]);

    render(<GoldenSetUpload onComplete={mockOnComplete} />);

    await waitFor(() => {
      const continueButton = screen.getByRole("button", { name: /Continue to Calibration/i });
      expect(continueButton).toBeDisabled();
    });
  });

  // AC-5: Continue callback fires
  it("calls onComplete when Continue button is clicked", async () => {
    mockInvoke.mockResolvedValue([
      { id: 1, content: "word ".repeat(200), word_count: 200, source_filename: "1.txt", created_at: "2024-01-01" },
      { id: 2, content: "word ".repeat(200), word_count: 200, source_filename: "2.txt", created_at: "2024-01-02" },
      { id: 3, content: "word ".repeat(200), word_count: 200, source_filename: "3.txt", created_at: "2024-01-03" },
    ]);

    render(<GoldenSetUpload onComplete={mockOnComplete} />);

    await waitFor(() => {
      const continueButton = screen.getByRole("button", { name: /Continue to Calibration/i });
      expect(continueButton).toBeEnabled();
    });

    const continueButton = screen.getByRole("button", { name: /Continue to Calibration/i });
    fireEvent.click(continueButton);

    expect(mockOnComplete).toHaveBeenCalledTimes(1);
  });

  // Privacy indicator (Story 5-6)
  it("shows privacy indicator", async () => {
    render(<GoldenSetUpload onComplete={mockOnComplete} />);

    await waitFor(() => {
      expect(
        screen.getByText(/Your proposals never leave your device/i)
      ).toBeInTheDocument();
    });
  });
});
