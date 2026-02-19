import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

// Mock TipTap useEditor
const mockSetContent = vi.fn();
const mockGetHTML = vi.fn(() => "<p>Test content</p>");
const mockEditor = {
  chain: () => ({
    focus: () => ({
      toggleBold: () => ({ run: vi.fn() }),
      toggleItalic: () => ({ run: vi.fn() }),
      toggleBulletList: () => ({ run: vi.fn() }),
      toggleOrderedList: () => ({ run: vi.fn() }),
      unsetAllMarks: () => ({ clearNodes: () => ({ run: vi.fn() }) }),
      undo: () => ({ run: vi.fn() }),
      redo: () => ({ run: vi.fn() }),
    }),
  }),
  can: () => ({
    chain: () => ({
      focus: () => ({
        toggleBold: () => ({ run: () => true }),
        toggleItalic: () => ({ run: () => true }),
        toggleBulletList: () => ({ run: () => true }),
        toggleOrderedList: () => ({ run: () => true }),
        undo: () => ({ run: () => true }),
        redo: () => ({ run: () => true }),
      }),
    }),
  }),
  isActive: () => false,
  getHTML: mockGetHTML,
  commands: {
    setContent: mockSetContent,
  },
};

let onUpdateCallback: ((params: { editor: typeof mockEditor }) => void) | null = null;

vi.mock("@tiptap/react", () => ({
  useEditor: (config: { onUpdate?: (params: { editor: typeof mockEditor }) => void }) => {
    // Capture the onUpdate callback for testing
    if (config.onUpdate) {
      onUpdateCallback = config.onUpdate;
    }
    return mockEditor;
  },
}));

vi.mock("@tiptap/starter-kit", () => ({
  default: { configure: () => ({}) },
}));

vi.mock("@tiptap/extension-placeholder", () => ({
  default: { configure: () => ({}) },
}));

// Import after mocks are set up
import { useProposalEditor } from "./useProposalEditor";

describe("useProposalEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    onUpdateCallback = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns editor instance", () => {
    const { result } = renderHook(() =>
      useProposalEditor({
        initialContent: "<p>Test</p>",
        proposalId: 1,
      }),
    );

    expect(result.current.editor).toBe(mockEditor);
  });

  it("initializes with idle save status", () => {
    const { result } = renderHook(() =>
      useProposalEditor({
        initialContent: "<p>Test</p>",
        proposalId: 1,
      }),
    );

    expect(result.current.saveStatus).toBe("idle");
  });

  it("initializes with isDirty false", () => {
    const { result } = renderHook(() =>
      useProposalEditor({
        initialContent: "<p>Test</p>",
        proposalId: 1,
      }),
    );

    expect(result.current.isDirty).toBe(false);
  });

  it("provides swapContent function", () => {
    const { result } = renderHook(() =>
      useProposalEditor({
        initialContent: "<p>Test</p>",
        proposalId: 1,
      }),
    );

    expect(typeof result.current.swapContent).toBe("function");
  });

  it("swapContent calls setContent on editor", () => {
    const { result } = renderHook(() =>
      useProposalEditor({
        initialContent: "<p>Initial</p>",
        proposalId: 1,
      }),
    );

    act(() => {
      result.current.swapContent("<p>New content</p>", 2);
    });

    expect(mockSetContent).toHaveBeenCalledWith("<p>New content</p>", {
      emitUpdate: false,
    });
  });

  it("swapContent resets dirty state", () => {
    const { result } = renderHook(() =>
      useProposalEditor({
        initialContent: "<p>Initial</p>",
        proposalId: 1,
      }),
    );

    act(() => {
      result.current.swapContent("<p>New content</p>", 2);
    });

    expect(result.current.isDirty).toBe(false);
    expect(result.current.saveStatus).toBe("idle");
  });

  it("provides saveNow function", () => {
    const { result } = renderHook(() =>
      useProposalEditor({
        initialContent: "<p>Test</p>",
        proposalId: 1,
      }),
    );

    expect(typeof result.current.saveNow).toBe("function");
  });

  it("auto-saves after 2 seconds when content changes", async () => {
    mockInvoke.mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useProposalEditor({
        initialContent: "<p>Initial</p>",
        proposalId: 1,
      }),
    );

    // Simulate content change via onUpdate callback
    mockGetHTML.mockReturnValue("<p>Changed content</p>");

    act(() => {
      if (onUpdateCallback) {
        onUpdateCallback({ editor: mockEditor });
      }
    });

    // Fast-forward 2 seconds (AUTO_SAVE_DELAY)
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(mockInvoke).toHaveBeenCalledWith("update_proposal_content", {
      proposalId: 1,
      content: "<p>Changed content</p>",
    });
  });

  it("does not auto-save when proposalId is null", async () => {
    const { result } = renderHook(() =>
      useProposalEditor({
        initialContent: "<p>Initial</p>",
        proposalId: null,
      }),
    );

    // Simulate content change
    mockGetHTML.mockReturnValue("<p>Changed content</p>");

    act(() => {
      if (onUpdateCallback) {
        onUpdateCallback({ editor: mockEditor });
      }
    });

    // Fast-forward 2 seconds
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("sets saveStatus to saving during save", async () => {
    // Create a promise we can control for update_proposal_content
    let resolveInvoke: () => void;
    mockInvoke.mockImplementation(
      (command: string) => {
        if (command === "update_proposal_content") {
          return new Promise<void>((resolve) => {
            resolveInvoke = resolve;
          });
        }
        // create_revision and other calls resolve immediately
        return Promise.resolve();
      },
    );

    const { result } = renderHook(() =>
      useProposalEditor({
        initialContent: "<p>Initial</p>",
        proposalId: 1,
      }),
    );

    // Trigger save
    mockGetHTML.mockReturnValue("<p>Changed</p>");
    act(() => {
      if (onUpdateCallback) {
        onUpdateCallback({ editor: mockEditor });
      }
    });

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    // Should be saving
    expect(result.current.saveStatus).toBe("saving");

    // Complete the save
    await act(async () => {
      resolveInvoke!();
    });

    expect(result.current.saveStatus).toBe("saved");
  });

  it("sets saveStatus to saving during failed save attempt (retries scheduled)", async () => {
    mockInvoke.mockRejectedValue(new Error("Save failed"));

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { result } = renderHook(() =>
      useProposalEditor({
        initialContent: "<p>Initial</p>",
        proposalId: 1,
      }),
    );

    // Trigger save
    mockGetHTML.mockReturnValue("<p>Changed</p>");
    act(() => {
      if (onUpdateCallback) {
        onUpdateCallback({ editor: mockEditor });
      }
    });

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    // Wait for promise rejection
    await act(async () => {
      await Promise.resolve();
    });

    // With retry logic, first failure schedules retry, so status is still "saving"
    // (error status only after MAX_RETRY_ATTEMPTS)
    expect(result.current.saveStatus).toBe("saving");

    consoleSpy.mockRestore();
    logSpy.mockRestore();
  });

  it("debounces multiple rapid changes", async () => {
    mockInvoke.mockResolvedValue(undefined);

    renderHook(() =>
      useProposalEditor({
        initialContent: "<p>Initial</p>",
        proposalId: 1,
      }),
    );

    // Simulate multiple rapid changes
    for (let i = 0; i < 5; i++) {
      mockGetHTML.mockReturnValue(`<p>Change ${i}</p>`);
      act(() => {
        if (onUpdateCallback) {
          onUpdateCallback({ editor: mockEditor });
        }
      });
      await act(async () => {
        vi.advanceTimersByTime(500); // Less than 2000ms debounce
      });
    }

    // No saves yet (debounced)
    expect(mockInvoke).not.toHaveBeenCalled();

    // Wait for final debounce to complete
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    // Only one save with final content (create_revision also fires, so filter by command)
    const updateCalls = mockInvoke.mock.calls.filter(
      ([cmd]: [string]) => cmd === "update_proposal_content",
    );
    expect(updateCalls).toHaveLength(1);
    expect(mockInvoke).toHaveBeenCalledWith("update_proposal_content", {
      proposalId: 1,
      content: "<p>Change 4</p>",
    });
  });

  it("calls onContentChange callback when content updates", () => {
    const onContentChange = vi.fn();

    renderHook(() =>
      useProposalEditor({
        initialContent: "<p>Initial</p>",
        proposalId: 1,
        onContentChange,
      }),
    );

    mockGetHTML.mockReturnValue("<p>New content</p>");
    act(() => {
      if (onUpdateCallback) {
        onUpdateCallback({ editor: mockEditor });
      }
    });

    expect(onContentChange).toHaveBeenCalledWith("<p>New content</p>");
  });

  it("resets saveStatus from saved to idle after 2 seconds", async () => {
    mockInvoke.mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useProposalEditor({
        initialContent: "<p>Initial</p>",
        proposalId: 1,
      }),
    );

    // Trigger content change and save
    mockGetHTML.mockReturnValue("<p>Changed</p>");
    act(() => {
      if (onUpdateCallback) {
        onUpdateCallback({ editor: mockEditor });
      }
    });

    // Wait for debounce + save
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    // Wait for save promise to resolve
    await act(async () => {
      await Promise.resolve();
    });

    // Should be "saved"
    expect(result.current.saveStatus).toBe("saved");

    // Advance 2 seconds for status reset
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    // Should reset to "idle"
    expect(result.current.saveStatus).toBe("idle");
  });

  it("retries save with exponential backoff on failure", async () => {
    // Fail twice, then succeed
    mockInvoke
      .mockRejectedValueOnce(new Error("Network error"))
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce(undefined);

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { result } = renderHook(() =>
      useProposalEditor({
        initialContent: "<p>Initial</p>",
        proposalId: 1,
      }),
    );

    // Trigger save
    mockGetHTML.mockReturnValue("<p>Changed</p>");
    act(() => {
      if (onUpdateCallback) {
        onUpdateCallback({ editor: mockEditor });
      }
    });

    // Helper to count update_proposal_content calls (create_revision also fires on success)
    const updateCallCount = () =>
      mockInvoke.mock.calls.filter(([cmd]: [string]) => cmd === "update_proposal_content").length;

    // Initial save attempt (after 2s debounce)
    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    expect(updateCallCount()).toBe(1);

    // First retry after 1s (base delay)
    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    expect(updateCallCount()).toBe(2);

    // Second retry after 2s (exponential backoff: 1000 * 2^1)
    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    expect(updateCallCount()).toBe(3);
    expect(result.current.saveStatus).toBe("saved");

    consoleSpy.mockRestore();
    logSpy.mockRestore();
  });

  it("sets error status after max retry attempts", async () => {
    // Fail all attempts
    mockInvoke.mockRejectedValue(new Error("Persistent error"));

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { result } = renderHook(() =>
      useProposalEditor({
        initialContent: "<p>Initial</p>",
        proposalId: 1,
      }),
    );

    // Trigger save
    mockGetHTML.mockReturnValue("<p>Changed</p>");
    act(() => {
      if (onUpdateCallback) {
        onUpdateCallback({ editor: mockEditor });
      }
    });

    // Initial save (fails)
    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    // Retry 1 after 1s
    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    // Retry 2 after 2s
    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    // Retry 3 after 4s
    await act(async () => {
      vi.advanceTimersByTime(4000);
      await Promise.resolve();
    });

    // After 3 retries, should be in error state
    expect(result.current.saveStatus).toBe("error");
    expect(mockInvoke).toHaveBeenCalledTimes(4); // 1 initial + 3 retries

    consoleSpy.mockRestore();
    logSpy.mockRestore();
  });
});
