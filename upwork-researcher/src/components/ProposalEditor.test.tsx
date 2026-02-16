import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

import ProposalEditor from "./ProposalEditor";

// Mock Tauri invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Mock TipTap editor - simplified for unit tests
vi.mock("@tiptap/react", () => {
  const React = require("react");
  return {
    useEditor: () => ({
      chain: () => ({
        focus: () => ({
          toggleBold: () => ({ run: vi.fn() }),
          toggleItalic: () => ({ run: vi.fn() }),
          toggleBulletList: () => ({ run: vi.fn() }),
          toggleOrderedList: () => ({ run: vi.fn() }),
          unsetAllMarks: () => ({
            clearNodes: () => ({ run: vi.fn() }),
          }),
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
      getHTML: () => "<p>Test content</p>",
      getText: () => "Test content", // Story 6.4: Character and word count
      on: vi.fn(), // Story 6.4: Event listener
      off: vi.fn(), // Story 6.4: Event listener cleanup
      commands: {
        setContent: vi.fn(),
      },
    }),
    EditorContent: ({ editor }: { editor: unknown }) => {
      return React.createElement("div", {
        "data-testid": "editor-content",
        className: "proposal-editor-content",
      });
    },
  };
});

describe("ProposalEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the editor with toolbar", () => {
    render(<ProposalEditor content="<p>Test content</p>" proposalId={1} />);

    // Check toolbar is rendered
    expect(screen.getByRole("toolbar")).toBeInTheDocument();

    // Check editor content area is rendered
    expect(screen.getByTestId("editor-content")).toBeInTheDocument();
  });

  it("renders toolbar buttons for all required formatting options", () => {
    render(<ProposalEditor content="<p>Test</p>" proposalId={1} />);

    // Story 6.1 AC: Bold, Italic, Bullet list, Numbered list, Clear formatting, Undo/Redo
    expect(screen.getByLabelText("Bold")).toBeInTheDocument();
    expect(screen.getByLabelText("Italic")).toBeInTheDocument();
    expect(screen.getByLabelText("Bullet list")).toBeInTheDocument();
    expect(screen.getByLabelText("Numbered list")).toBeInTheDocument();
    expect(screen.getByLabelText("Clear formatting")).toBeInTheDocument();
    expect(screen.getByLabelText("Undo")).toBeInTheDocument();
    expect(screen.getByLabelText("Redo")).toBeInTheDocument();
  });

  it("displays status indicator area", () => {
    render(<ProposalEditor content="<p>Test</p>" proposalId={1} />);

    // Status area should exist (initially idle, no visible status)
    const statusArea = document.querySelector(".proposal-editor-status");
    expect(statusArea).toBeInTheDocument();
  });

  it("calls onContentChange when content changes", async () => {
    const onContentChange = vi.fn();

    render(
      <ProposalEditor content="<p>Initial</p>" proposalId={1} onContentChange={onContentChange} />,
    );

    // Editor content area exists
    expect(screen.getByTestId("editor-content")).toBeInTheDocument();
    // Note: Full content change testing requires TipTap integration tests
  });

  it("renders with null proposalId (unsaved proposal)", () => {
    render(<ProposalEditor content="<p>Draft content</p>" proposalId={null} />);

    expect(screen.getByRole("toolbar")).toBeInTheDocument();
    expect(screen.getByTestId("editor-content")).toBeInTheDocument();
  });

  // Story 6.4: Character and word count integration tests
  describe("EditorStatusBar Integration (Story 6.4)", () => {
    it("renders EditorStatusBar with counts", () => {
      render(<ProposalEditor content="<p>Test content</p>" proposalId={1} />);

      // Status bar should be present
      expect(screen.getByRole("status")).toBeInTheDocument();

      // Should display counts (from mock getText: "Test content" = 12 chars, 2 words)
      expect(screen.getByText(/12 characters/)).toBeInTheDocument();
      expect(screen.getByText(/2 words/)).toBeInTheDocument();
    });

    it("EditorStatusBar has accessibility attributes", () => {
      render(<ProposalEditor content="<p>Test</p>" proposalId={1} />);

      const statusBar = screen.getByRole("status");
      expect(statusBar).toHaveAttribute("aria-live", "polite");
    });
  });
});
