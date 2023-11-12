export interface IndividualUserStatistic {
  name?: string;
  email: string;
  totalQuizCompletions: number;
  averageScorePercentage: number;
}

export type IndividualUserStatisticsSortOption = 'QUIZZES_COMPLETED_DESC' | 'AVERAGE_SCORE_DESC';
