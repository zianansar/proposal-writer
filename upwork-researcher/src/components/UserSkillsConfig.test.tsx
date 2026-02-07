import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import UserSkillsConfig from "./UserSkillsConfig";
import { invoke } from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const mockedInvoke = vi.mocked(invoke);

describe("UserSkillsConfig", () => {
  const mockSkills = [
    { id: 1, skill: "JavaScript", added_at: "2024-01-01 10:00:00", is_primary: false },
    { id: 2, skill: "React", added_at: "2024-01-01 10:00:01", is_primary: false },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Default: return empty skills list for get_user_skills
    mockedInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_user_skills") return Promise.resolve([]);
      if (cmd === "get_skill_suggestions") return Promise.resolve([]);
      return Promise.resolve(undefined);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  // Task 8, Subtask 8.1: Test UserSkillsConfig renders input field
  it("renders input field", async () => {
    await act(async () => {
      render(<UserSkillsConfig />);
    });

    const input = screen.getByPlaceholderText(/Type to add skills/i);
    expect(input).toBeInTheDocument();
  });

  // Task 8, Subtask 8.2: Test typing in input calls get_skill_suggestions (debounced)
  it("calls get_skill_suggestions after debounce", async () => {
    mockedInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_user_skills") return Promise.resolve([]);
      if (cmd === "get_skill_suggestions") return Promise.resolve(["JavaScript"]);
      return Promise.resolve(undefined);
    });

    await act(async () => {
      render(<UserSkillsConfig />);
    });

    const input = screen.getByPlaceholderText(/Type to add skills/i);

    await act(async () => {
      fireEvent.change(input, { target: { value: "java" } });
    });

    // Should not call immediately (only get_user_skills on mount)
    expect(mockedInvoke).toHaveBeenCalledTimes(1);

    // Fast-forward 300ms (debounce time)
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(mockedInvoke).toHaveBeenCalledWith("get_skill_suggestions", { query: "java" });
  });

  // Task 8, Subtask 8.3: Test autocomplete suggestions appear in dropdown
  it("displays autocomplete suggestions", async () => {
    mockedInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_user_skills") return Promise.resolve([]);
      if (cmd === "get_skill_suggestions") return Promise.resolve(["JavaScript", "Java"]);
      return Promise.resolve(undefined);
    });

    await act(async () => {
      render(<UserSkillsConfig />);
    });

    const input = screen.getByPlaceholderText(/Type to add skills/i);

    await act(async () => {
      fireEvent.change(input, { target: { value: "java" } });
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByText("JavaScript")).toBeInTheDocument();
    expect(screen.getByText("Java")).toBeInTheDocument();
  });

  // Task 8, Subtask 8.4: Test clicking suggestion adds skill and clears input
  it("adds skill when clicking suggestion", async () => {
    let skillsList: typeof mockSkills = [];
    mockedInvoke.mockImplementation((cmd: string, args?: unknown) => {
      if (cmd === "get_user_skills") return Promise.resolve(skillsList);
      if (cmd === "get_skill_suggestions") return Promise.resolve(["JavaScript"]);
      if (cmd === "add_user_skill") {
        const typedArgs = args as { skill: string };
        skillsList = [{ id: 1, skill: typedArgs.skill, added_at: "2024-01-01", is_primary: false }];
        return Promise.resolve(1);
      }
      return Promise.resolve(undefined);
    });

    await act(async () => {
      render(<UserSkillsConfig />);
    });

    const input = screen.getByPlaceholderText(/Type to add skills/i) as HTMLInputElement;

    await act(async () => {
      fireEvent.change(input, { target: { value: "java" } });
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByText("JavaScript")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText("JavaScript"));
    });

    expect(mockedInvoke).toHaveBeenCalledWith("add_user_skill", { skill: "JavaScript" });
    expect(input.value).toBe(""); // Input should be cleared
  });

  // Task 8, Subtask 8.5: Test Enter key adds skill from input
  it("adds skill when pressing Enter", async () => {
    mockedInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_user_skills") return Promise.resolve([]);
      if (cmd === "add_user_skill") return Promise.resolve(1);
      return Promise.resolve(undefined);
    });

    await act(async () => {
      render(<UserSkillsConfig />);
    });

    const input = screen.getByPlaceholderText(/Type to add skills/i);

    await act(async () => {
      fireEvent.change(input, { target: { value: "Python" } });
      fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    });

    expect(mockedInvoke).toHaveBeenCalledWith("add_user_skill", { skill: "Python" });
  });

  // Task 8, Subtask 8.6: Test current skills render as removable tags
  it("renders skills as removable tags", async () => {
    mockedInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_user_skills") return Promise.resolve(mockSkills);
      return Promise.resolve(undefined);
    });

    await act(async () => {
      render(<UserSkillsConfig />);
    });

    expect(screen.getByText("JavaScript")).toBeInTheDocument();
    expect(screen.getByText("React")).toBeInTheDocument();

    // Check for remove buttons
    const removeButtons = screen.getAllByLabelText(/Remove/i);
    expect(removeButtons).toHaveLength(2);
  });

  // Task 8, Subtask 8.7: Test clicking "X" on tag calls remove_user_skill
  it("removes skill when clicking X button", async () => {
    mockedInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_user_skills") return Promise.resolve(mockSkills);
      if (cmd === "remove_user_skill") return Promise.resolve(undefined);
      return Promise.resolve(undefined);
    });

    await act(async () => {
      render(<UserSkillsConfig />);
    });

    expect(screen.getByText("JavaScript")).toBeInTheDocument();

    const removeButton = screen.getByLabelText("Remove JavaScript");

    await act(async () => {
      fireEvent.click(removeButton);
    });

    expect(mockedInvoke).toHaveBeenCalledWith("remove_user_skill", { skillId: 1 });
  });

  // Task 8, Subtask 8.8: Test "Saving..." indicator appears during add/remove
  it("shows saving indicator during add operation", async () => {
    let resolveAdd: (value: number) => void;
    const addPromise = new Promise<number>((resolve) => {
      resolveAdd = resolve;
    });

    mockedInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_user_skills") return Promise.resolve([]);
      if (cmd === "add_user_skill") return addPromise;
      return Promise.resolve(undefined);
    });

    await act(async () => {
      render(<UserSkillsConfig />);
    });

    const input = screen.getByPlaceholderText(/Type to add skills/i);

    await act(async () => {
      fireEvent.change(input, { target: { value: "Python" } });
      fireEvent.keyDown(input, { key: "Enter" });
    });

    expect(screen.getByText("Saving...")).toBeInTheDocument();

    // Resolve the promise
    await act(async () => {
      resolveAdd!(1);
    });

    expect(screen.queryByText("Saving...")).not.toBeInTheDocument();
  });

  // Task 8, Subtask 8.9: Test duplicate skill shows error toast
  it("shows error message for duplicate skill", async () => {
    mockedInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_user_skills") return Promise.resolve([]);
      if (cmd === "add_user_skill") {
        return Promise.reject(new Error("Skill already exists (case-insensitive)"));
      }
      return Promise.resolve(undefined);
    });

    await act(async () => {
      render(<UserSkillsConfig />);
    });

    const input = screen.getByPlaceholderText(/Type to add skills/i);

    await act(async () => {
      fireEvent.change(input, { target: { value: "JavaScript" } });
      fireEvent.keyDown(input, { key: "Enter" });
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Skill already added");
  });

  // Task 8, Subtask 8.10: Test accessibility: keyboard navigation, aria-live, focus management
  it("has proper accessibility attributes", async () => {
    await act(async () => {
      render(<UserSkillsConfig />);
    });

    const input = screen.getByPlaceholderText(/Type to add skills/i);
    expect(input).toHaveAttribute("aria-label", "Add skills for job matching");
  });

  it("saving indicator has aria-live for screen readers", async () => {
    let resolveAdd: (value: number) => void;
    const addPromise = new Promise<number>((resolve) => {
      resolveAdd = resolve;
    });

    mockedInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_user_skills") return Promise.resolve([]);
      if (cmd === "add_user_skill") return addPromise;
      return Promise.resolve(undefined);
    });

    await act(async () => {
      render(<UserSkillsConfig />);
    });

    const input = screen.getByPlaceholderText(/Type to add skills/i);

    await act(async () => {
      fireEvent.change(input, { target: { value: "Python" } });
      fireEvent.keyDown(input, { key: "Enter" });
    });

    const savingIndicator = screen.getByText("Saving...");
    expect(savingIndicator).toHaveAttribute("aria-live", "polite");

    await act(async () => {
      resolveAdd!(1);
    });
  });

  it("shows empty state when no skills added", async () => {
    mockedInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_user_skills") return Promise.resolve([]);
      return Promise.resolve(undefined);
    });

    await act(async () => {
      render(<UserSkillsConfig />);
    });

    expect(screen.getByText(/No skills added yet/i)).toBeInTheDocument();
  });

  it("handles Enter key on empty input gracefully", async () => {
    await act(async () => {
      render(<UserSkillsConfig />);
    });

    const input = screen.getByPlaceholderText(/Type to add skills/i);

    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });

    // Should not call add_user_skill for empty input
    expect(mockedInvoke).not.toHaveBeenCalledWith("add_user_skill", expect.anything());
  });

  it("closes suggestions on Escape key", async () => {
    mockedInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_user_skills") return Promise.resolve([]);
      if (cmd === "get_skill_suggestions") return Promise.resolve(["JavaScript"]);
      return Promise.resolve(undefined);
    });

    await act(async () => {
      render(<UserSkillsConfig />);
    });

    const input = screen.getByPlaceholderText(/Type to add skills/i);

    await act(async () => {
      fireEvent.change(input, { target: { value: "java" } });
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByText("JavaScript")).toBeInTheDocument();

    await act(async () => {
      fireEvent.keyDown(input, { key: "Escape" });
    });

    expect(screen.queryByText("JavaScript")).not.toBeInTheDocument();
  });

  // M-2: Test arrow key navigation for autocomplete (NFR-14)
  it("navigates suggestions with arrow keys", async () => {
    mockedInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_user_skills") return Promise.resolve([]);
      if (cmd === "get_skill_suggestions") return Promise.resolve(["JavaScript", "Java"]);
      if (cmd === "add_user_skill") return Promise.resolve(1);
      return Promise.resolve(undefined);
    });

    await act(async () => {
      render(<UserSkillsConfig />);
    });

    const input = screen.getByPlaceholderText(/Type to add skills/i);

    await act(async () => {
      fireEvent.change(input, { target: { value: "java" } });
      vi.advanceTimersByTime(300);
    });

    // Arrow down to select first item
    await act(async () => {
      fireEvent.keyDown(input, { key: "ArrowDown" });
    });

    const javaScriptOption = screen.getByText("JavaScript").closest('[role="option"]');
    expect(javaScriptOption).toHaveAttribute("aria-selected", "true");

    // Arrow down again to select second item
    await act(async () => {
      fireEvent.keyDown(input, { key: "ArrowDown" });
    });

    const javaOption = screen.getByText("Java").closest('[role="option"]');
    expect(javaOption).toHaveAttribute("aria-selected", "true");

    // Press Enter to add the selected suggestion
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });

    expect(mockedInvoke).toHaveBeenCalledWith("add_user_skill", { skill: "Java" });
  });
});
