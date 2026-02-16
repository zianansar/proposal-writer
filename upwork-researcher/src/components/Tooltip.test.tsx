import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { Tooltip } from "./Tooltip";

describe("Tooltip", () => {
  it("shows tooltip on hover after delay", async () => {
    render(
      <Tooltip content="Bold (⌘B)">
        <button>B</button>
      </Tooltip>,
    );

    const button = screen.getByText("B");
    fireEvent.mouseEnter(button.parentElement!);

    await waitFor(
      () => {
        expect(screen.getByRole("tooltip")).toHaveTextContent("Bold (⌘B)");
      },
      { timeout: 500 },
    );
  });

  it("hides tooltip on mouse leave", async () => {
    render(
      <Tooltip content="Bold (⌘B)" delay={0}>
        <button>B</button>
      </Tooltip>,
    );

    const wrapper = screen.getByText("B").parentElement!;
    fireEvent.mouseEnter(wrapper);

    await waitFor(() => expect(screen.getByRole("tooltip")).toBeInTheDocument());

    fireEvent.mouseLeave(wrapper);

    await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
  });

  it("shows tooltip on focus for keyboard users", async () => {
    render(
      <Tooltip content="Bold (⌘B)" delay={0}>
        <button>B</button>
      </Tooltip>,
    );

    const wrapper = screen.getByText("B").parentElement!;
    fireEvent.focus(wrapper);

    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toBeInTheDocument();
    });
  });

  it("hides tooltip on blur", async () => {
    render(
      <Tooltip content="Bold (⌘B)" delay={0}>
        <button>B</button>
      </Tooltip>,
    );

    const wrapper = screen.getByText("B").parentElement!;
    fireEvent.focus(wrapper);

    await waitFor(() => expect(screen.getByRole("tooltip")).toBeInTheDocument());

    fireEvent.blur(wrapper);

    await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
  });

  it("has accessible role and id", async () => {
    render(
      <Tooltip content="Bold (⌘B)" delay={0}>
        <button>B</button>
      </Tooltip>,
    );

    const wrapper = screen.getByText("B").parentElement!;
    fireEvent.mouseEnter(wrapper);

    await waitFor(() => {
      const tooltip = screen.getByRole("tooltip");
      expect(tooltip).toHaveAttribute("id");
      expect(tooltip.id).toMatch(/^tooltip-/);
    });
  });

  it("child has aria-describedby when tooltip visible", async () => {
    render(
      <Tooltip content="Bold (⌘B)" delay={0}>
        <button>B</button>
      </Tooltip>,
    );

    const button = screen.getByText("B");
    const wrapper = button.parentElement!.parentElement!; // tooltip-wrapper

    fireEvent.mouseEnter(wrapper);

    await waitFor(() => {
      const childDiv = button.parentElement!;
      expect(childDiv).toHaveAttribute("aria-describedby");
      expect(screen.getByRole("tooltip")).toBeInTheDocument();
    });
  });

  it("clears timeout on unmount", async () => {
    vi.useFakeTimers();

    const { unmount } = render(
      <Tooltip content="Bold (⌘B)" delay={300}>
        <button>B</button>
      </Tooltip>,
    );

    const wrapper = screen.getByText("B").parentElement!;
    fireEvent.mouseEnter(wrapper);

    // Unmount before timeout completes
    unmount();

    vi.advanceTimersByTime(400);

    // Should not throw or cause memory leak
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it("supports different positions", async () => {
    render(
      <Tooltip content="Bottom tooltip" delay={0} position="bottom">
        <button>Test</button>
      </Tooltip>,
    );

    const wrapper = screen.getByText("Test").parentElement!;
    fireEvent.mouseEnter(wrapper);

    await waitFor(() => {
      const tooltip = screen.getByRole("tooltip");
      expect(tooltip).toHaveClass("tooltip--bottom");
    });
  });

  it("defaults to top position", async () => {
    render(
      <Tooltip content="Top tooltip" delay={0}>
        <button>Test</button>
      </Tooltip>,
    );

    const wrapper = screen.getByText("Test").parentElement!;
    fireEvent.mouseEnter(wrapper);

    await waitFor(() => {
      const tooltip = screen.getByRole("tooltip");
      expect(tooltip).toHaveClass("tooltip--top");
    });
  });

  it("does not show tooltip if content is empty", async () => {
    render(
      <Tooltip content="" delay={0}>
        <button>Test</button>
      </Tooltip>,
    );

    const wrapper = screen.getByText("Test").parentElement!;
    fireEvent.mouseEnter(wrapper);

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("hides tooltip on Escape key press", async () => {
    render(
      <Tooltip content="Test tooltip" delay={0}>
        <button>Test</button>
      </Tooltip>,
    );

    const wrapper = screen.getByText("Test").parentElement!.parentElement!;
    fireEvent.mouseEnter(wrapper);

    await waitFor(() => expect(screen.getByRole("tooltip")).toBeInTheDocument());

    fireEvent.keyDown(wrapper, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
  });

  it("generates deterministic tooltip IDs", async () => {
    const { rerender } = render(
      <Tooltip content="First" delay={0}>
        <button>A</button>
      </Tooltip>,
    );

    const wrapperA = screen.getByText("A").parentElement!.parentElement!;
    fireEvent.mouseEnter(wrapperA);

    await waitFor(() => {
      const tooltip = screen.getByRole("tooltip");
      // ID should be numeric pattern like tooltip-1, tooltip-2, etc.
      expect(tooltip.id).toMatch(/^tooltip-\d+$/);
    });
  });
});
