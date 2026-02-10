import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EditorStatusBar } from "./EditorStatusBar";

describe("EditorStatusBar", () => {
  it("displays character count", () => {
    render(<EditorStatusBar characterCount={342} wordCount={67} />);
    expect(screen.getByText("342 characters")).toBeInTheDocument();
  });

  it("displays word count", () => {
    render(<EditorStatusBar characterCount={342} wordCount={67} />);
    expect(screen.getByText("67 words")).toBeInTheDocument();
  });

  it("displays zero counts", () => {
    render(<EditorStatusBar characterCount={0} wordCount={0} />);
    expect(screen.getByText("0 characters")).toBeInTheDocument();
    expect(screen.getByText("0 words")).toBeInTheDocument();
  });

  it("shows warning when 0 words (empty editor)", () => {
    render(<EditorStatusBar characterCount={0} wordCount={0} />);
    expect(screen.getByText("Upwork recommends 200-500 words")).toBeInTheDocument();
  });

  it("shows warning when under 200 words", () => {
    render(<EditorStatusBar characterCount={500} wordCount={100} />);
    expect(screen.getByText("Upwork recommends 200-500 words")).toBeInTheDocument();
  });

  it("shows warning when exactly 199 words", () => {
    render(<EditorStatusBar characterCount={1000} wordCount={199} />);
    expect(screen.getByText("Upwork recommends 200-500 words")).toBeInTheDocument();
  });

  it("shows warning when over 600 words", () => {
    render(<EditorStatusBar characterCount={3500} wordCount={650} />);
    expect(screen.getByText("Long proposals may not be fully read")).toBeInTheDocument();
  });

  it("shows warning when exactly 601 words", () => {
    render(<EditorStatusBar characterCount={3500} wordCount={601} />);
    expect(screen.getByText("Long proposals may not be fully read")).toBeInTheDocument();
  });

  it("shows no warning at exactly 200 words", () => {
    render(<EditorStatusBar characterCount={1000} wordCount={200} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows no warning at exactly 600 words", () => {
    render(<EditorStatusBar characterCount={3500} wordCount={600} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows no warning in ideal range (300 words)", () => {
    render(<EditorStatusBar characterCount={1500} wordCount={300} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("has accessible role for screen readers", () => {
    render(<EditorStatusBar characterCount={342} wordCount={67} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("warning has alert role for screen readers", () => {
    render(<EditorStatusBar characterCount={500} wordCount={100} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("includes warning icon when warning is shown", () => {
    render(<EditorStatusBar characterCount={500} wordCount={100} />);
    const statusBar = screen.getByRole("status");
    expect(statusBar.textContent).toContain("⚠️");
  });

  it("has aria-live polite for status updates", () => {
    render(<EditorStatusBar characterCount={342} wordCount={67} />);
    const statusBar = screen.getByRole("status");
    expect(statusBar).toHaveAttribute("aria-live", "polite");
  });

  it("count separator has aria-hidden", () => {
    const { container } = render(<EditorStatusBar characterCount={342} wordCount={67} />);
    const separator = container.querySelector(".count-separator");
    expect(separator).toHaveAttribute("aria-hidden", "true");
  });

  it("warning icon has aria-hidden", () => {
    const { container } = render(<EditorStatusBar characterCount={100} wordCount={50} />);
    const icon = container.querySelector(".warning-icon");
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });
});
