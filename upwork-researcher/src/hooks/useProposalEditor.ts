import { useRef, useCallback, useEffect, useState } from "react";
import { useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { invoke } from "@tauri-apps/api/core";

/** Auto-save debounce delay in ms (Story 6.1: 2 seconds) */
const AUTO_SAVE_DELAY = 2000;

/** Maximum retry attempts for failed saves */
const MAX_RETRY_ATTEMPTS = 3;

/** Base delay for exponential backoff (ms) */
const RETRY_BASE_DELAY = 1000;

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface UseProposalEditorOptions {
  /** Initial content to load into editor */
  initialContent: string;
  /** Proposal ID for auto-save (required for database updates) */
  proposalId: number | null;
  /** Callback when content changes */
  onContentChange?: (content: string) => void;
}

interface UseProposalEditorReturn {
  /** TipTap editor instance */
  editor: Editor | null;
  /** Current save status */
  saveStatus: SaveStatus;
  /** Whether editor has unsaved changes */
  isDirty: boolean;
  /** Swap content for a new proposal (clears history) */
  swapContent: (newContent: string, newProposalId: number | null) => void;
  /** Force save current content */
  saveNow: () => Promise<void>;
}

/**
 * Hook for managing TipTap editor lifecycle (Story 6.1)
 *
 * Features:
 * - Persistent editor instance (reused across proposals)
 * - Content swap via setContent() - NOT remounting
 * - Transaction history cleared on new proposal load
 * - Auto-save with 2-second debounce
 * - Dirty state tracking
 */
export function useProposalEditor({
  initialContent,
  proposalId,
  onContentChange,
}: UseProposalEditorOptions): UseProposalEditorReturn {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [isDirty, setIsDirty] = useState(false);

  // Refs for mutable state that shouldn't trigger re-renders
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedContentRef = useRef<string>(initialContent);
  const proposalIdRef = useRef<number | null>(proposalId);
  const currentContentRef = useRef<string>(initialContent);
  const retryCountRef = useRef<number>(0);

  // Configure TipTap editor (created once, reused)
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // TipTap 3.x: history is included by default
      }),
      Placeholder.configure({
        placeholder: "Your proposal will appear here...",
      }),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: "proposal-editor-content",
        role: "textbox",
        "aria-label": "Proposal editor",
        "aria-multiline": "true",
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      currentContentRef.current = html;
      onContentChange?.(html);

      // Track dirty state
      const hasChanges = html !== lastSavedContentRef.current;
      setIsDirty(hasChanges);

      if (hasChanges) {
        setSaveStatus("idle");
        scheduleAutoSave(html);
      }
    },
  });

  // Save to database with retry logic
  const saveToDatabase = useCallback(async (htmlContent: string, isRetry = false) => {
    const currentProposalId = proposalIdRef.current;
    if (!currentProposalId) {
      return; // No proposal ID, can't save
    }

    // Reset retry count on fresh save attempt
    if (!isRetry) {
      retryCountRef.current = 0;
    }

    setSaveStatus("saving");

    try {
      await invoke("update_proposal_content", {
        proposalId: currentProposalId,
        content: htmlContent,
      });
      lastSavedContentRef.current = htmlContent;
      setIsDirty(false);
      setSaveStatus("saved");
      retryCountRef.current = 0; // Reset on success

      // Clear any existing status timeout
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }

      // Reset to idle after 2 seconds
      statusTimeoutRef.current = setTimeout(() => {
        setSaveStatus((current) => (current === "saved" ? "idle" : current));
      }, 2000);
    } catch (err) {
      console.error("Auto-save failed:", err);

      // Retry with exponential backoff if under max attempts
      if (retryCountRef.current < MAX_RETRY_ATTEMPTS) {
        retryCountRef.current += 1;
        const delay = RETRY_BASE_DELAY * Math.pow(2, retryCountRef.current - 1);
        console.log(`Retrying save in ${delay}ms (attempt ${retryCountRef.current}/${MAX_RETRY_ATTEMPTS})`);

        // Clear any existing retry timeout
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
        }

        retryTimeoutRef.current = setTimeout(() => {
          saveToDatabase(htmlContent, true);
        }, delay);
      } else {
        // Max retries exceeded, set error state
        setSaveStatus("error");
        retryCountRef.current = 0;
      }
    }
  }, []);

  // Schedule auto-save with debounce
  const scheduleAutoSave = useCallback(
    (htmlContent: string) => {
      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Schedule new save
      saveTimeoutRef.current = setTimeout(() => {
        saveToDatabase(htmlContent);
      }, AUTO_SAVE_DELAY);
    },
    [saveToDatabase]
  );

  // Swap content for new proposal (Story 6.1: persistent editor instance)
  const swapContent = useCallback(
    (newContent: string, newProposalId: number | null) => {
      if (!editor) return;

      // Update refs
      proposalIdRef.current = newProposalId;
      lastSavedContentRef.current = newContent;
      currentContentRef.current = newContent;

      // Clear pending save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }

      // Set new content with emitUpdate: false to avoid triggering onUpdate
      // This effectively creates a new document state (Story 6.1: memory management)
      editor.commands.setContent(newContent, { emitUpdate: false });

      // Reset state
      setIsDirty(false);
      setSaveStatus("idle");
    },
    [editor]
  );

  // Force immediate save
  const saveNow = useCallback(async () => {
    // Clear pending debounced save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    await saveToDatabase(currentContentRef.current);
  }, [saveToDatabase]);

  // Cleanup all timeouts on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  return {
    editor,
    saveStatus,
    isDirty,
    swapContent,
    saveNow,
  };
}

export default useProposalEditor;
