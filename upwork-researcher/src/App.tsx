import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import JobInput from "./components/JobInput";
import GenerateButton from "./components/GenerateButton";
import ProposalOutput from "./components/ProposalOutput";
import "./App.css";

function App() {
  const [jobContent, setJobContent] = useState("");
  const [proposal, setProposal] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!jobContent.trim()) {
      setError("Please paste a job post first.");
      return;
    }

    setLoading(true);
    setError(null);
    setProposal(null);

    try {
      const result = await invoke<string>("generate_proposal", {
        jobContent: jobContent,
      });
      setProposal(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container">
      <h1>Upwork Research Agent</h1>
      <JobInput onJobContentChange={setJobContent} />
      <GenerateButton
        onClick={handleGenerate}
        disabled={!jobContent.trim()}
        loading={loading}
      />
      <ProposalOutput proposal={proposal} loading={loading} error={error} />
    </main>
  );
}

export default App;
