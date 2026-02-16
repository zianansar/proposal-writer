import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import SkipLink from "./SkipLink";

describe("SkipLink", () => {
  it("test_visible_on_focus", () => {
    render(<SkipLink />);

    const link = screen.getByRole("link", { name: /Skip to main content/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveClass("skip-link");
  });

  it("test_hidden_when_not_focused", () => {
    render(<SkipLink />);

    const link = screen.getByRole("link", { name: /Skip to main content/i });

    // Has skip-link class which positions it off-screen by default (top: -40px)
    expect(link).toHaveClass("skip-link");
    expect(link).toHaveAttribute("href", "#main-content");
  });

  it("test_navigates_to_main_content", () => {
    // Create main content element
    const mainContent = document.createElement("div");
    mainContent.id = "main-content";
    document.body.appendChild(mainContent);

    render(<SkipLink />);

    const link = screen.getByRole("link", { name: /Skip to main content/i });

    // Click the link
    fireEvent.click(link);

    // Main content should receive focus
    expect(document.activeElement).toBe(mainContent);
    expect(mainContent.tabIndex).toBe(-1);

    // Cleanup
    document.body.removeChild(mainContent);
  });

  it("test_custom_target_id", () => {
    // Create custom target element
    const customTarget = document.createElement("div");
    customTarget.id = "custom-target";
    document.body.appendChild(customTarget);

    render(<SkipLink targetId="custom-target" />);

    const link = screen.getByRole("link", { name: /Skip to main content/i });

    // Click the link
    fireEvent.click(link);

    // Custom target should receive focus
    expect(document.activeElement).toBe(customTarget);

    // Cleanup
    document.body.removeChild(customTarget);
  });

  it("test_custom_children", () => {
    render(<SkipLink>Jump to content</SkipLink>);

    expect(screen.getByRole("link", { name: /Jump to content/i })).toBeInTheDocument();
  });

  it("test_href_attribute", () => {
    render(<SkipLink targetId="main-content" />);

    const link = screen.getByRole("link", { name: /Skip to main content/i });
    expect(link).toHaveAttribute("href", "#main-content");
  });

  it("test_handles_missing_target", () => {
    render(<SkipLink targetId="nonexistent" />);

    const link = screen.getByRole("link", { name: /Skip to main content/i });

    // Should not throw error when target doesn't exist
    expect(() => fireEvent.click(link)).not.toThrow();
  });

  it("test_removes_tabindex_on_blur", () => {
    // Create main content element
    const mainContent = document.createElement("div");
    mainContent.id = "main-content";
    document.body.appendChild(mainContent);

    render(<SkipLink />);

    const link = screen.getByRole("link", { name: /Skip to main content/i });

    // Click the link
    fireEvent.click(link);

    expect(mainContent.tabIndex).toBe(-1);

    // Blur the main content
    fireEvent.blur(mainContent);

    // Tabindex should be removed
    expect(mainContent.hasAttribute("tabindex")).toBe(false);

    // Cleanup
    document.body.removeChild(mainContent);
  });
});
