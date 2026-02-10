// Story 4b.10: Scoring Feedback Types

export enum ScoringFeedbackIssue {
  SkillsMismatch = "skillsMismatch",
  ClientQualityWrong = "clientQualityWrong",
  BudgetWrong = "budgetWrong",
  ScoreTooHigh = "scoreTooHigh",
  ScoreTooLow = "scoreTooLow",
  Other = "other",
}

export interface SubmitScoringFeedbackInput {
  jobPostId: number;
  issues: ScoringFeedbackIssue[];
  userNotes?: string;
}

export interface ScoringFeedbackResult {
  feedbackId: number;
  success: boolean;
}

export interface CanReportResult {
  canReport: boolean;
  lastReportedAt?: string;
}
