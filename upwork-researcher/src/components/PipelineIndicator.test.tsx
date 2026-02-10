import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import PipelineIndicator from "./PipelineIndicator";
import { useGenerationStore } from "../stores/useGenerationStore";

describe("PipelineIndicator", () => {
  beforeEach(() => {
    useGenerationStore.getState().reset();
  });

  it("renders all stages when streaming", () => {
    useGenerationStore.setState({ isStreaming: true });

    render(<PipelineIndicator />);

    expect(screen.getByText("Preparing...")).toBeInTheDocument();
    expect(screen.getByText("Generating proposal...")).toBeInTheDocument();
    expect(screen.getByText("Complete!")).toBeInTheDocument();
  });

  it("hides when not streaming and no history", () => {
    useGenerationStore.setState({ isStreaming: false, stageHistory: [] });

    const { container } = render(<PipelineIndicator />);

    expect(container.firstChild).toBeNull();
  });

  it("shows active stage with spinner", () => {
    useGenerationStore.getState().setStage("preparing", "active");
    useGenerationStore.setState({ isStreaming: true });

    render(<PipelineIndicator />);

    const preparingStage = screen.getByText("Preparing...").closest("li");
    expect(preparingStage).toHaveClass("pipeline-stage--active");
    expect(preparingStage?.querySelector(".spinner")).toBeInTheDocument();
    expect(preparingStage).toHaveAttribute("aria-current", "step");
  });

  it("shows complete stage with checkmark", () => {
    useGenerationStore.getState().setStage("preparing", "active");
    useGenerationStore.getState().setStage("preparing", "complete");
    useGenerationStore.setState({ isStreaming: true });

    render(<PipelineIndicator />);

    const preparingStage = screen.getByText("Preparing...").closest("li");
    expect(preparingStage).toHaveClass("pipeline-stage--complete");
    expect(preparingStage?.textContent).toContain("✓");
  });

  it("shows error stage with ✗", () => {
    useGenerationStore.getState().setStage("generating", "active");
    useGenerationStore.getState().setStage("generating", "error", "API timeout");
    useGenerationStore.setState({ isStreaming: false });

    render(<PipelineIndicator />);

    const generatingStage = screen.getByText("Generating proposal...").closest("li");
    expect(generatingStage).toHaveClass("pipeline-stage--error");
    expect(generatingStage?.textContent).toContain("✗");
  });

  it("shows pending stages with ○", () => {
    useGenerationStore.getState().setStage("preparing", "active");
    useGenerationStore.setState({ isStreaming: true });

    render(<PipelineIndicator />);

    const generatingStage = screen.getByText("Generating proposal...").closest("li");
    expect(generatingStage).toHaveClass("pipeline-stage--pending");
    expect(generatingStage?.textContent).toContain("○");
  });

  it("displays duration for completed stages", () => {
    // Manually create stage with duration
    useGenerationStore.setState({
      isStreaming: false,
      stageHistory: [
        {
          id: "preparing",
          status: "complete",
          startedAt: Date.now() - 500,
          completedAt: Date.now(),
          durationMs: 500,
        },
      ],
    });

    render(<PipelineIndicator />);

    expect(screen.getByText("0.5s")).toBeInTheDocument();
  });

  it("shows stage transitions correctly", () => {
    useGenerationStore.getState().setStage("preparing", "active");
    useGenerationStore.getState().setStage("generating", "active");
    useGenerationStore.setState({ isStreaming: true });

    render(<PipelineIndicator />);

    const preparingStage = screen.getByText("Preparing...").closest("li");
    const generatingStage = screen.getByText("Generating proposal...").closest("li");
    const completeStage = screen.getByText("Complete!").closest("li");

    // Preparing should be complete
    expect(preparingStage).toHaveClass("pipeline-stage--complete");

    // Generating should be active
    expect(generatingStage).toHaveClass("pipeline-stage--active");

    // Complete should be pending
    expect(completeStage).toHaveClass("pipeline-stage--pending");
  });

  it("has accessible attributes", () => {
    useGenerationStore.getState().setStage("preparing", "active");
    useGenerationStore.setState({ isStreaming: true });

    const { container } = render(<PipelineIndicator />);

    const indicator = container.querySelector(".pipeline-indicator");
    expect(indicator).toHaveAttribute("role", "status");
    expect(indicator).toHaveAttribute("aria-live", "polite");

    const activeStage = screen.getByText("Preparing...").closest("li");
    expect(activeStage).toHaveAttribute("aria-current", "step");
  });
});
