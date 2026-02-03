interface GenerateButtonProps {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}

function GenerateButton({ onClick, disabled, loading }: GenerateButtonProps) {
  return (
    <button
      className="generate-button"
      onClick={onClick}
      disabled={disabled || loading}
      type="button"
    >
      {loading ? "Generating..." : "Generate Proposal"}
    </button>
  );
}

export default GenerateButton;
