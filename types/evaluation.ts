export interface TierScore {
  available: number;
  earned: number;
  percentage: number;
}

export interface BuriedTreasureAnalysis {
  directMarks: TierScore;     // Tier 1
  indirectMarks: TierScore;   // Tier 2
  thinkingMarks: TierScore;   // Tier 3

  knowledgeScore: TierScore;  // Tier 1 + 2
  applicationScore: TierScore;// Tier 3

  macroCommScore: TierScore;  // X1 / Layout marks

  hasTheoryGap: boolean;
  primaryFailureCause: 'THEORY_GAP' | 'EXECUTION_GAP' | 'BREADTH_OMISSION' | 'MECHANICS_FAILURE';

  diagnosticHeadline: string;
  keyTakeaways: string[];
  actionPlan: string[];
  fullReportMarkdown: string;
}
