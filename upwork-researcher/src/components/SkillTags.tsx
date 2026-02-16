/**
 * SkillTags Component (Story 4a.3: Task 5)
 *
 * Displays extracted job skills as styled tag chips.
 *
 * AC-2: Skills displayed as styled tags below client name
 * AC-5: Shows "No skills detected" when skills array is empty
 */

import "./SkillTags.css";

interface SkillTagsProps {
  skills: string[];
}

export default function SkillTags({ skills }: SkillTagsProps) {
  if (skills.length === 0) {
    return (
      <p className="no-skills" data-testid="no-skills">
        No skills detected
      </p>
    );
  }

  return (
    <div className="skill-tags" data-testid="skill-tags">
      {skills.map((skill, index) => (
        <span key={index} className="skill-tag" data-testid="skill-tag">
          {skill}
        </span>
      ))}
    </div>
  );
}
