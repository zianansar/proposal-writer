// Story 7.4 + 7.5: Accept broader View type (proposal-detail is a sub-view of history, analytics is a top-level view)
interface NavigationProps {
  activeView: string;
  onViewChange: (view: "generate" | "history" | "analytics" | "settings") => void;
}

function Navigation({ activeView, onViewChange }: NavigationProps) {
  return (
    <nav className="navigation" aria-label="Main navigation">
      {/* M2 fix: Proper tablist pattern for ARIA tab navigation */}
      <div role="tablist" aria-label="App sections">
        <button
          id="generate-tab"
          className={`nav-tab ${activeView === "generate" ? "nav-tab--active" : ""}`}
          onClick={() => onViewChange("generate")}
          type="button"
          role="tab"
          aria-selected={activeView === "generate"}
          aria-controls="generate-panel"
        >
          Generate
        </button>
        <button
          id="history-tab"
          className={`nav-tab ${activeView === "history" || activeView === "proposal-detail" ? "nav-tab--active" : ""}`}
          onClick={() => onViewChange("history")}
          type="button"
          role="tab"
          aria-selected={activeView === "history" || activeView === "proposal-detail"}
          aria-controls="history-panel"
        >
          History
        </button>
        <button
          id="analytics-tab"
          className={`nav-tab ${activeView === "analytics" ? "nav-tab--active" : ""}`}
          onClick={() => onViewChange("analytics")}
          type="button"
          role="tab"
          aria-selected={activeView === "analytics"}
          aria-controls="analytics-panel"
        >
          Analytics
        </button>
        <button
          id="settings-tab"
          className={`nav-tab ${activeView === "settings" ? "nav-tab--active" : ""}`}
          onClick={() => onViewChange("settings")}
          type="button"
          role="tab"
          aria-selected={activeView === "settings"}
          aria-controls="settings-panel"
        >
          Settings
        </button>
      </div>
    </nav>
  );
}

export default Navigation;
