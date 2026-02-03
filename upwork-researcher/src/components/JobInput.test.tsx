import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import JobInput from "./JobInput";

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
