import { create } from "zustand";

interface DraftRecovery {
  id: number;
  jobContent: string;
  generatedText: string;
}

interface GenerationState {
  /** Accumulated tokens from streaming */
  tokens: string[];
  /** Whether streaming is currently in progress */
  isStreaming: boolean;
  /** Error message if generation failed */
  error: string | null;
  /** Full text when generation is complete */
  fullText: string | null;
  /** Whether the proposal has been saved to database */
  isSaved: boolean;
  /** Database ID of saved proposal */
  savedId: number | null;
  /** Number of retry attempts for current generation (Story 1.13) */
  retryCount: number;
  /** Draft recovery data from previous session (Story 1.14) */
  draftRecovery: DraftRecovery | null;
}

interface GenerationActions {
  /** Append a batch of tokens to the accumulated tokens */
  appendTokens: (newTokens: string[]) => void;
  /** Set streaming state (true when starting, false when done) */
  setStreaming: (isStreaming: boolean) => void;
  /** Set error message (preserves tokens for partial result) */
  setError: (message: string) => void;
  /** Set full text when generation completes */
  setComplete: (fullText: string) => void;
  /** Mark proposal as saved with its database ID */
  setSaved: (id: number) => void;
  /** Increment retry count (Story 1.13) */
  incrementRetry: () => void;
  /** Set draft recovery data (Story 1.14) */
  setDraftRecovery: (draft: DraftRecovery) => void;
  /** Clear draft recovery data (Story 1.14) */
  clearDraftRecovery: () => void;
  /** Reset store to initial state for new generation */
  reset: () => void;
}

const initialState: GenerationState = {
  tokens: [],
  isStreaming: false,
  error: null,
  fullText: null,
  isSaved: false,
  savedId: null,
  retryCount: 0,
  draftRecovery: null,
};

export const useGenerationStore = create<GenerationState & GenerationActions>(
  (set) => ({
    ...initialState,

    appendTokens: (newTokens) =>
      set((state) => ({
        tokens: [...state.tokens, ...newTokens],
      })),

    setStreaming: (isStreaming) =>
      set((state) => ({
        isStreaming,
        // Clear error when starting new generation, preserve when stopping
        error: isStreaming ? null : state.error,
      })),

    setError: (message) =>
      set({
        error: message,
        isStreaming: false,
        // Note: tokens are preserved so partial result is kept
      }),

    setComplete: (fullText) =>
      set({
        fullText,
        isStreaming: false,
      }),

    setSaved: (id) =>
      set({
        isSaved: true,
        savedId: id,
      }),

    incrementRetry: () =>
      set((state) => ({
        retryCount: state.retryCount + 1,
      })),

    setDraftRecovery: (draft) =>
      set({
        draftRecovery: draft,
      }),

    clearDraftRecovery: () =>
      set({
        draftRecovery: null,
      }),

    reset: () => set(initialState),
  })
);

/** Get concatenated text from all tokens */
export const getStreamedText = (state: GenerationState): string =>
  state.tokens.join("");
