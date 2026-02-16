import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import Navigation from "./Navigation";

describe("Navigation", () => {
  it("renders all three tabs", () => {
    render(<Navigation activeView="generate" onViewChange={() => {}} />);

    expect(screen.getByRole("tab", { name: /generate/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /history/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /settings/i })).toBeInTheDocument();
  });

  it("highlights the active tab", () => {
    render(<Navigation activeView="generate" onViewChange={() => {}} />);

    const generateTab = screen.getByRole("tab", { name: /generate/i });
    const historyTab = screen.getByRole("tab", { name: /history/i });
    const settingsTab = screen.getByRole("tab", { name: /settings/i });

    expect(generateTab).toHaveClass("nav-tab--active");
    expect(historyTab).not.toHaveClass("nav-tab--active");
    expect(settingsTab).not.toHaveClass("nav-tab--active");
  });

  it("highlights history tab when active", () => {
    render(<Navigation activeView="history" onViewChange={() => {}} />);

    const generateTab = screen.getByRole("tab", { name: /generate/i });
    const historyTab = screen.getByRole("tab", { name: /history/i });

    expect(generateTab).not.toHaveClass("nav-tab--active");
    expect(historyTab).toHaveClass("nav-tab--active");
  });

  it("highlights settings tab when active", () => {
    render(<Navigation activeView="settings" onViewChange={() => {}} />);

    const settingsTab = screen.getByRole("tab", { name: /settings/i });

    expect(settingsTab).toHaveClass("nav-tab--active");
  });

  it("calls onViewChange when clicking generate tab", () => {
    const handleViewChange = vi.fn();
    render(<Navigation activeView="history" onViewChange={handleViewChange} />);

    fireEvent.click(screen.getByRole("tab", { name: /generate/i }));

    expect(handleViewChange).toHaveBeenCalledWith("generate");
  });

  it("calls onViewChange when clicking history tab", () => {
    const handleViewChange = vi.fn();
    render(<Navigation activeView="generate" onViewChange={handleViewChange} />);

    fireEvent.click(screen.getByRole("tab", { name: /history/i }));

    expect(handleViewChange).toHaveBeenCalledWith("history");
  });

  it("calls onViewChange when clicking settings tab", () => {
    const handleViewChange = vi.fn();
    render(<Navigation activeView="generate" onViewChange={handleViewChange} />);

    fireEvent.click(screen.getByRole("tab", { name: /settings/i }));

    expect(handleViewChange).toHaveBeenCalledWith("settings");
  });
});
