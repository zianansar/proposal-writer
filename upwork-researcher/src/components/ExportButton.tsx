import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";

interface ExportResult {
  success: boolean;
  filePath: string | null;
  proposalCount: number;
  message: string;
}

interface ExportButtonProps {
  className?: string;
}

function ExportButton({ className }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [result, setResult] = useState<ExportResult | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setResult(null);

    try {
      const exportResult = await invoke<ExportResult>("export_proposals_to_json");
      setResult(exportResult);
    } catch (err) {
      setResult({
        success: false,
        filePath: null,
        proposalCount: 0,
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={`export-button-container ${className || ""}`}>
      <button onClick={handleExport} disabled={isExporting} className="export-button">
        {isExporting ? "Exporting..." : "Export to JSON"}
      </button>

      {result && (
        <div
          className={`export-result ${result.success ? "export-result--success" : "export-result--error"}`}
        >
          {result.message}
        </div>
      )}
    </div>
  );
}

export default ExportButton;
