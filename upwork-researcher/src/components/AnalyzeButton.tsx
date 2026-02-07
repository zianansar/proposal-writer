/// Story 4a.2: Analyze Job button component
/// Secondary/outline variant to distinguish from primary Generate action

interface AnalyzeButtonProps {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}

function AnalyzeButton({ onClick, disabled, loading }: AnalyzeButtonProps) {
  const buttonText = loading ? "Analyzing..." : "Analyze Job";

  return (
    <button
      className="analyze-button"
      onClick={onClick}
      disabled={disabled || loading}
      type="button"
      title="Extract job details (client name, skills, needs)"
    >
      {buttonText}
    </button>
  );
}

export default AnalyzeButton;
