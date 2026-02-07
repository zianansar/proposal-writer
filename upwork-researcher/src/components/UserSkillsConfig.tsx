import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./UserSkillsConfig.css";

interface UserSkill {
  id: number;
  skill: string;
  added_at: string;
  is_primary: boolean;
}

function UserSkillsConfig() {
  const [skills, setSkills] = useState<UserSkill[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1); // M-2: Arrow key navigation

  // Load user skills on mount
  useEffect(() => {
    loadSkills();
  }, []);

  const loadSkills = async () => {
    try {
      const userSkills = await invoke<UserSkill[]>("get_user_skills");
      setSkills(userSkills);
    } catch (err) {
      console.error("Failed to load skills:", err);
      setError(`Failed to load skills: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Debounced autocomplete suggestions (300ms)
  useEffect(() => {
    if (inputValue.trim() === "") {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const skillSuggestions = await invoke<string[]>("get_skill_suggestions", {
          query: inputValue.trim(),
        });
        setSuggestions(skillSuggestions);
        setShowSuggestions(skillSuggestions.length > 0);
        setSelectedIndex(-1); // Reset selection when suggestions change
      } catch (err) {
        console.error("Failed to get suggestions:", err);
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [inputValue]);

  const addSkill = useCallback(async (skillToAdd: string) => {
    const trimmed = skillToAdd.trim();
    if (!trimmed) return;

    setIsSaving(true);
    setError(null);

    try {
      await invoke<number>("add_user_skill", { skill: trimmed });
      setInputValue("");
      setSuggestions([]);
      setShowSuggestions(false);
      await loadSkills();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.includes("already exists") || errorMessage.includes("duplicate")) {
        setError("Skill already added");
      } else {
        setError(`Failed to add skill: ${errorMessage}`);
      }
    } finally {
      setIsSaving(false);
    }
  }, []);

  const removeSkill = async (skillId: number) => {
    setIsSaving(true);
    setError(null);

    try {
      await invoke("remove_user_skill", { skillId });
      await loadSkills();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Failed to remove skill: ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      // M-2: If a suggestion is selected, add that; otherwise add input value
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        addSkill(suggestions[selectedIndex]);
      } else {
        addSkill(inputValue);
      }
      setSelectedIndex(-1);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setSelectedIndex(-1);
    } else if (e.key === "ArrowDown") {
      // M-2: Navigate down in suggestions (NFR-14 keyboard nav)
      e.preventDefault();
      if (showSuggestions && suggestions.length > 0) {
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
      }
    } else if (e.key === "ArrowUp") {
      // M-2: Navigate up in suggestions (NFR-14 keyboard nav)
      e.preventDefault();
      if (showSuggestions && suggestions.length > 0) {
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
      }
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    addSkill(suggestion);
  };

  return (
    <div className="user-skills-config">
      <div className="skills-input-container">
        <div className="input-wrapper">
          <input
            type="text"
            className="skills-input"
            placeholder="Type to add skills (e.g., JavaScript, React, Python)"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            disabled={isSaving}
            aria-label="Add skills for job matching"
          />
          {isSaving && (
            <span className="saving-indicator" aria-live="polite">
              Saving...
            </span>
          )}
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <div className="suggestions-dropdown" role="listbox" aria-label="Skill suggestions">
            {suggestions.map((suggestion, index) => (
              <div
                key={suggestion}
                className={`suggestion-item${index === selectedIndex ? " suggestion-item--selected" : ""}`}
                onClick={() => handleSuggestionClick(suggestion)}
                role="option"
                aria-selected={index === selectedIndex}
              >
                {suggestion}
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}

      <div className="skills-tags">
        {skills.length === 0 && (
          <p className="empty-state">
            No skills added yet. Add your skills to enable job matching.
          </p>
        )}
        {skills.map((skill) => (
          <div key={skill.id} className="skill-tag">
            <span className="skill-name">{skill.skill}</span>
            <button
              className="skill-remove-btn"
              onClick={() => removeSkill(skill.id)}
              disabled={isSaving}
              aria-label={`Remove ${skill.skill}`}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default UserSkillsConfig;
