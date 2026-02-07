import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import JobInput, { detectInputType } from "./JobInput";

describe("JobInput", () => {
  it("renders a textarea", () => {
    render(<JobInput />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("displays placeholder text explaining what to paste", () => {
    render(<JobInput />);
    expect(
      screen.getByPlaceholderText(/paste a job post url or the full job description/i)
    ).toBeInTheDocument();
  });

  it("renders a label", () => {
    render(<JobInput />);
    expect(screen.getByLabelText(/job post/i)).toBeInTheDocument();
  });

  it("accepts user input", async () => {
    const user = userEvent.setup();
    render(<JobInput />);
    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "https://upwork.com/jobs/123");
    expect(textarea).toHaveValue("https://upwork.com/jobs/123");
  });

  it("accepts pasted raw text", async () => {
    const user = userEvent.setup();
    render(<JobInput />);
    const textarea = screen.getByRole("textbox");
    const jobText = "Looking for a React developer to build a dashboard...";
    await user.click(textarea);
    await user.paste(jobText);
    expect(textarea).toHaveValue(jobText);
  });

  it("calls onJobContentChange when input changes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<JobInput onJobContentChange={onChange} />);
    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "test");
    expect(onChange).toHaveBeenCalledWith("t");
    expect(onChange).toHaveBeenLastCalledWith("test");
  });
});

// Story 4a.1: detectInputType unit tests
describe("detectInputType", () => {
  it("returns url type for https:// URLs", () => {
    const result = detectInputType("https://upwork.com/jobs/123");
    expect(result).toEqual({ type: "url", url: "https://upwork.com/jobs/123" });
  });

  it("returns url type for http:// URLs", () => {
    const result = detectInputType("http://example.com/job");
    expect(result).toEqual({ type: "url", url: "http://example.com/job" });
  });

  it("returns text type for plain text", () => {
    const result = detectInputType("Looking for a React developer");
    expect(result).toEqual({ type: "text", url: null });
  });

  it("returns null type for empty string", () => {
    const result = detectInputType("");
    expect(result).toEqual({ type: null, url: null });
  });

  it("returns null type for whitespace-only string", () => {
    const result = detectInputType("   \n  ");
    expect(result).toEqual({ type: null, url: null });
  });

  it("returns text type for multi-line content with URL at start", () => {
    const content = "https://upwork.com/jobs/123\nLooking for a developer";
    const result = detectInputType(content);
    expect(result).toEqual({ type: "text", url: null });
  });

  it("returns text type for text containing URL mid-text", () => {
    const content = "Check out https://upwork.com/jobs/123 for the job";
    const result = detectInputType(content);
    expect(result).toEqual({ type: "text", url: null });
  });

  it("trims whitespace and still detects URL", () => {
    const result = detectInputType("  https://upwork.com/jobs/123  ");
    expect(result).toEqual({ type: "url", url: "https://upwork.com/jobs/123" });
  });

  it("handles very long URLs", () => {
    const longUrl = "https://upwork.com/jobs/" + "a".repeat(500);
    const result = detectInputType(longUrl);
    expect(result).toEqual({ type: "url", url: longUrl });
  });
});

// Story 4a.1: Visual indicator component tests
describe("JobInput visual indicators", () => {
  it("shows no indicator when input is empty", () => {
    render(<JobInput />);
    expect(screen.queryByText(/detected/i)).not.toBeInTheDocument();
  });

  it("shows 'Job URL detected' when URL is entered", async () => {
    const user = userEvent.setup();
    render(<JobInput />);
    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "https://upwork.com/jobs/123");
    expect(screen.getByText("🔗 Job URL detected")).toBeInTheDocument();
  });

  it("shows 'Raw job text detected' when text is entered", async () => {
    const user = userEvent.setup();
    render(<JobInput />);
    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "Looking for a React developer");
    expect(screen.getByText("📝 Raw job text detected")).toBeInTheDocument();
  });

  it("calls onInputTypeChange with url type when URL is entered", async () => {
    const user = userEvent.setup();
    const onInputTypeChange = vi.fn();
    render(<JobInput onInputTypeChange={onInputTypeChange} />);
    const textarea = screen.getByRole("textbox");
    await user.clear(textarea);
    await user.type(textarea, "https://upwork.com/jobs/123");

    // Should have been called with url type and the URL
    expect(onInputTypeChange).toHaveBeenLastCalledWith(
      "url",
      "https://upwork.com/jobs/123"
    );
  });

  it("calls onInputTypeChange with text type when text is entered", async () => {
    const user = userEvent.setup();
    const onInputTypeChange = vi.fn();
    render(<JobInput onInputTypeChange={onInputTypeChange} />);
    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "Looking for a developer");

    // Should have been called with text type and null url
    expect(onInputTypeChange).toHaveBeenLastCalledWith("text", null);
  });

  it("calls onInputTypeChange with null when input is cleared", async () => {
    const user = userEvent.setup();
    const onInputTypeChange = vi.fn();
    render(<JobInput onInputTypeChange={onInputTypeChange} />);
    const textarea = screen.getByRole("textbox");

    // Type something first
    await user.type(textarea, "test");
    // Then clear it
    await user.clear(textarea);

    expect(onInputTypeChange).toHaveBeenLastCalledWith(null, null);
  });

  it("has accessible status indicators with role and aria-live", async () => {
    const user = userEvent.setup();
    render(<JobInput />);
    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "https://example.com");

    const indicator = screen.getByRole("status");
    expect(indicator).toHaveAttribute("aria-live", "polite");
  });

  it("syncs inputType when value prop changes externally (controlled mode)", async () => {
    const onInputTypeChange = vi.fn();
    const { rerender } = render(
      <JobInput value="" onInputTypeChange={onInputTypeChange} />
    );

    // Simulate external value change (e.g., draft recovery)
    rerender(
      <JobInput value="https://upwork.com/jobs/456" onInputTypeChange={onInputTypeChange} />
    );

    // Should detect URL type and show indicator
    expect(screen.getByText("🔗 Job URL detected")).toBeInTheDocument();
    expect(onInputTypeChange).toHaveBeenCalledWith("url", "https://upwork.com/jobs/456");
  });
});
