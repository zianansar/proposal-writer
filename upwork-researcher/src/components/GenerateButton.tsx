import { getShortcutDisplay } from "../hooks/usePlatform";

interface GenerateButtonProps {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  cooldownSeconds?: number; // Story 3.8: Remaining cooldown time
}

function GenerateButton({ onClick, disabled, loading, cooldownSeconds = 0 }: GenerateButtonProps) {
  const isCoolingDown = cooldownSeconds > 0;

  // Story 3.9: Shortcut hint for tooltip
  const shortcutHint = getShortcutDisplay("generate");

  let buttonText = "Generate Proposal";
  if (loading) {
    buttonText = "Generating...";
  } else if (isCoolingDown) {
    buttonText = `Please wait ${cooldownSeconds}s`;
  }

  return (
    <button
      className={`generate-button ${isCoolingDown ? "cooldown" : ""}`}
      onClick={onClick}
      disabled={disabled || loading || isCoolingDown}
      type="button"
      title={`Generate proposal (${shortcutHint})`}
      aria-busy={loading}
      aria-disabled={isCoolingDown || undefined}
    >
      {buttonText}
    </button>
  );
}

export default GenerateButton;
