import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EditorToolbar from "./EditorToolbar";

// Create mock editor with tracking
const createMockEditor = () => {
  const runMocks = {
    bold: vi.fn(),
    italic: vi.fn(),
    bulletList: vi.fn(),
    orderedList: vi.fn(),
    clearFormatting: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
  };

  return {
    editor: {
      chain: () => ({
        focus: () => ({
          toggleBold: () => ({ run: runMocks.bold }),
          toggleItalic: () => ({ run: runMocks.italic }),
          toggleBulletList: () => ({ run: runMocks.bulletList }),
          toggleOrderedList: () => ({ run: runMocks.orderedList }),
          unsetAllMarks: () => ({
            clearNodes: () => ({ run: runMocks.clearFormatting }),
          }),
          undo: () => ({ run: runMocks.undo }),
          redo: () => ({ run: runMocks.redo }),
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
      isActive: (type: string) => false,
    },
    runMocks,
  };
};

describe("EditorToolbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when editor is null", () => {
    const { container } = render(<EditorToolbar editor={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders all required formatting buttons", () => {
    const { editor } = createMockEditor();
    // @ts-expect-error - simplified mock
    render(<EditorToolbar editor={editor} />);

    expect(screen.getByLabelText("Bold")).toBeInTheDocument();
    expect(screen.getByLabelText("Italic")).toBeInTheDocument();
    expect(screen.getByLabelText("Bullet list")).toBeInTheDocument();
    expect(screen.getByLabelText("Numbered list")).toBeInTheDocument();
    expect(screen.getByLabelText("Clear formatting")).toBeInTheDocument();
    expect(screen.getByLabelText("Undo")).toBeInTheDocument();
    expect(screen.getByLabelText("Redo")).toBeInTheDocument();
  });

  it("has toolbar role for accessibility", () => {
    const { editor } = createMockEditor();
    // @ts-expect-error - simplified mock
    render(<EditorToolbar editor={editor} />);

    expect(screen.getByRole("toolbar")).toBeInTheDocument();
    expect(screen.getByRole("toolbar")).toHaveAttribute(
      "aria-label",
      "Text formatting"
    );
  });

  it("calls toggleBold when Bold button clicked", async () => {
    const user = userEvent.setup();
    const { editor, runMocks } = createMockEditor();
    // @ts-expect-error - simplified mock
    render(<EditorToolbar editor={editor} />);

    await user.click(screen.getByLabelText("Bold"));
    expect(runMocks.bold).toHaveBeenCalled();
  });

  it("calls toggleItalic when Italic button clicked", async () => {
    const user = userEvent.setup();
    const { editor, runMocks } = createMockEditor();
    // @ts-expect-error - simplified mock
    render(<EditorToolbar editor={editor} />);

    await user.click(screen.getByLabelText("Italic"));
    expect(runMocks.italic).toHaveBeenCalled();
  });

  it("calls toggleBulletList when Bullet list button clicked", async () => {
    const user = userEvent.setup();
    const { editor, runMocks } = createMockEditor();
    // @ts-expect-error - simplified mock
    render(<EditorToolbar editor={editor} />);

    await user.click(screen.getByLabelText("Bullet list"));
    expect(runMocks.bulletList).toHaveBeenCalled();
  });

  it("calls toggleOrderedList when Numbered list button clicked", async () => {
    const user = userEvent.setup();
    const { editor, runMocks } = createMockEditor();
    // @ts-expect-error - simplified mock
    render(<EditorToolbar editor={editor} />);

    await user.click(screen.getByLabelText("Numbered list"));
    expect(runMocks.orderedList).toHaveBeenCalled();
  });

  it("calls clear formatting when Clear button clicked", async () => {
    const user = userEvent.setup();
    const { editor, runMocks } = createMockEditor();
    // @ts-expect-error - simplified mock
    render(<EditorToolbar editor={editor} />);

    await user.click(screen.getByLabelText("Clear formatting"));
    expect(runMocks.clearFormatting).toHaveBeenCalled();
  });

  it("calls undo when Undo button clicked", async () => {
    const user = userEvent.setup();
    const { editor, runMocks } = createMockEditor();
    // @ts-expect-error - simplified mock
    render(<EditorToolbar editor={editor} />);

    await user.click(screen.getByLabelText("Undo"));
    expect(runMocks.undo).toHaveBeenCalled();
  });

  it("calls redo when Redo button clicked", async () => {
    const user = userEvent.setup();
    const { editor, runMocks } = createMockEditor();
    // @ts-expect-error - simplified mock
    render(<EditorToolbar editor={editor} />);

    await user.click(screen.getByLabelText("Redo"));
    expect(runMocks.redo).toHaveBeenCalled();
  });

  it("shows active state for bold when active", () => {
    const { editor } = createMockEditor();
    // Override isActive to return true for bold
    editor.isActive = (type: string) => type === "bold";
    // @ts-expect-error - simplified mock
    render(<EditorToolbar editor={editor} />);

    const boldButton = screen.getByLabelText("Bold");
    expect(boldButton).toHaveClass("toolbar-button--active");
    expect(boldButton).toHaveAttribute("aria-pressed", "true");
  });

  it("has accessible keyboard navigation", () => {
    const { editor } = createMockEditor();
    // @ts-expect-error - simplified mock
    render(<EditorToolbar editor={editor} />);

    // All buttons should be type="button" to prevent form submission
    const buttons = screen.getAllByRole("button");
    buttons.forEach((button) => {
      expect(button).toHaveAttribute("type", "button");
    });
  });

  it("includes dividers between button groups", () => {
    const { editor } = createMockEditor();
    // @ts-expect-error - simplified mock
    const { container } = render(<EditorToolbar editor={editor} />);

    const dividers = container.querySelectorAll(".toolbar-divider");
    expect(dividers.length).toBeGreaterThan(0);
    // Dividers should be hidden from screen readers
    dividers.forEach((divider) => {
      expect(divider).toHaveAttribute("aria-hidden", "true");
    });
  });

  // Story 6.5: Platform-aware keyboard shortcuts in tooltips
  describe("keyboard shortcut tooltips", () => {
    it("shows Bold tooltip with Mac shortcut on macOS", async () => {
      vi.stubGlobal("navigator", {
        platform: "MacIntel",
      });

      const { editor } = createMockEditor();
      // @ts-expect-error - simplified mock
      render(<EditorToolbar editor={editor} />);

      const boldButton = screen.getByLabelText("Bold");
      const wrapper = boldButton.parentElement!;
      fireEvent.mouseEnter(wrapper);

      await waitFor(
        () => {
          expect(screen.getByRole("tooltip")).toHaveTextContent("Bold (⌘B)");
        },
        { timeout: 500 }
      );
    });

    it("shows Bold tooltip with Windows shortcut on Windows", async () => {
      vi.stubGlobal("navigator", {
        platform: "Win32",
      });

      const { editor } = createMockEditor();
      // @ts-expect-error - simplified mock
      render(<EditorToolbar editor={editor} />);

      const boldButton = screen.getByLabelText("Bold");
      const wrapper = boldButton.parentElement!;
      fireEvent.mouseEnter(wrapper);

      await waitFor(
        () => {
          expect(screen.getByRole("tooltip")).toHaveTextContent(
            "Bold (Ctrl+B)"
          );
        },
        { timeout: 500 }
      );
    });

    it("shows Italic tooltip with platform-aware shortcut", async () => {
      vi.stubGlobal("navigator", {
        platform: "MacIntel",
      });

      const { editor } = createMockEditor();
      // @ts-expect-error - simplified mock
      render(<EditorToolbar editor={editor} />);

      const italicButton = screen.getByLabelText("Italic");
      const wrapper = italicButton.parentElement!;
      fireEvent.mouseEnter(wrapper);

      await waitFor(
        () => {
          expect(screen.getByRole("tooltip")).toHaveTextContent("Italic (⌘I)");
        },
        { timeout: 500 }
      );
    });

    it("shows Undo tooltip with platform-aware shortcut", async () => {
      vi.stubGlobal("navigator", {
        platform: "Win32",
      });

      const { editor } = createMockEditor();
      // @ts-expect-error - simplified mock
      render(<EditorToolbar editor={editor} />);

      const undoButton = screen.getByLabelText("Undo");
      const wrapper = undoButton.parentElement!;
      fireEvent.mouseEnter(wrapper);

      await waitFor(
        () => {
          expect(screen.getByRole("tooltip")).toHaveTextContent(
            "Undo (Ctrl+Z)"
          );
        },
        { timeout: 500 }
      );
    });

    it("shows Redo tooltip with shift modifier on Mac", async () => {
      vi.stubGlobal("navigator", {
        platform: "MacIntel",
      });

      const { editor } = createMockEditor();
      // @ts-expect-error - simplified mock
      render(<EditorToolbar editor={editor} />);

      const redoButton = screen.getByLabelText("Redo");
      const wrapper = redoButton.parentElement!;
      fireEvent.mouseEnter(wrapper);

      await waitFor(
        () => {
          expect(screen.getByRole("tooltip")).toHaveTextContent("Redo (⇧⌘Z)");
        },
        { timeout: 500 }
      );
    });

    it("shows Redo tooltip with shift modifier on Windows", async () => {
      vi.stubGlobal("navigator", {
        platform: "Win32",
      });

      const { editor } = createMockEditor();
      // @ts-expect-error - simplified mock
      render(<EditorToolbar editor={editor} />);

      const redoButton = screen.getByLabelText("Redo");
      const wrapper = redoButton.parentElement!;
      fireEvent.mouseEnter(wrapper);

      await waitFor(
        () => {
          expect(screen.getByRole("tooltip")).toHaveTextContent(
            "Redo (Ctrl+Shift+Z)"
          );
        },
        { timeout: 500 }
      );
    });

    it("tooltips are accessible via keyboard focus", async () => {
      vi.stubGlobal("navigator", {
        platform: "MacIntel",
      });

      const { editor } = createMockEditor();
      // @ts-expect-error - simplified mock
      render(<EditorToolbar editor={editor} />);

      const boldButton = screen.getByLabelText("Bold");
      const wrapper = boldButton.parentElement!;

      // Focus should trigger tooltip
      fireEvent.focus(wrapper);

      await waitFor(
        () => {
          expect(screen.getByRole("tooltip")).toBeInTheDocument();
        },
        { timeout: 500 }
      );
    });
  });
});
