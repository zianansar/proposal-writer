interface NavigationProps {
  activeView: "generate" | "history" | "settings";
  onViewChange: (view: "generate" | "history" | "settings") => void;
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
          className={`nav-tab ${activeView === "history" ? "nav-tab--active" : ""}`}
          onClick={() => onViewChange("history")}
          type="button"
          role="tab"
          aria-selected={activeView === "history"}
          aria-controls="history-panel"
        >
          History
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
