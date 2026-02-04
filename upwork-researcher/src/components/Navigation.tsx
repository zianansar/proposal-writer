interface NavigationProps {
  activeView: "generate" | "history" | "settings";
  onViewChange: (view: "generate" | "history" | "settings") => void;
}

function Navigation({ activeView, onViewChange }: NavigationProps) {
  return (
    <nav className="navigation">
      <button
        className={`nav-tab ${activeView === "generate" ? "nav-tab--active" : ""}`}
        onClick={() => onViewChange("generate")}
        type="button"
      >
        Generate
      </button>
      <button
        className={`nav-tab ${activeView === "history" ? "nav-tab--active" : ""}`}
        onClick={() => onViewChange("history")}
        type="button"
      >
        History
      </button>
      <button
        className={`nav-tab ${activeView === "settings" ? "nav-tab--active" : ""}`}
        onClick={() => onViewChange("settings")}
        type="button"
      >
        Settings
      </button>
    </nav>
  );
}

export default Navigation;
