/**
 * SkillTags Component Tests (Story 4a.3: Task 6.8-6.10)
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import SkillTags from "./SkillTags";

describe("SkillTags", () => {
  it("renders tags for array of skills", () => {
    // Task 6.8: Test renders tags for skills array
    const skills = ["React", "TypeScript"];
    render(<SkillTags skills={skills} />);

    const skillTags = screen.getAllByTestId("skill-tag");
    expect(skillTags).toHaveLength(2);
    expect(skillTags[0]).toHaveTextContent("React");
    expect(skillTags[1]).toHaveTextContent("TypeScript");
  });

  it('shows "No skills detected" for empty array', () => {
    // Task 6.9: Test shows "No skills detected" for empty array
    render(<SkillTags skills={[]} />);

    expect(screen.getByTestId("no-skills")).toBeInTheDocument();
    expect(screen.getByText("No skills detected")).toBeInTheDocument();
  });

  it("renders multiple skills with proper styling", () => {
    const skills = ["React", "TypeScript", "API Integration", "Testing"];
    render(<SkillTags skills={skills} />);

    const container = screen.getByTestId("skill-tags");
    expect(container).toBeInTheDocument();
    expect(container.children).toHaveLength(4);
  });

  it("handles single skill", () => {
    render(<SkillTags skills={["JavaScript"]} />);

    const skillTags = screen.getAllByTestId("skill-tag");
    expect(skillTags).toHaveLength(1);
    expect(skillTags[0]).toHaveTextContent("JavaScript");
  });

  it("handles many skills (7+)", () => {
    const skills = [
      "React",
      "TypeScript",
      "Node.js",
      "PostgreSQL",
      "Docker",
      "Kubernetes",
      "AWS",
      "GraphQL",
    ];
    render(<SkillTags skills={skills} />);

    const skillTags = screen.getAllByTestId("skill-tag");
    expect(skillTags).toHaveLength(8);
  });
});
