import { QuizService } from '../quiz/quiz.service';
import { UserService } from '../user/user.service';
import { Cache } from '../util/cache';
import { IndividualUserStatistic, IndividualUserStatisticsSortOption } from './statistics.dto';

const INDIVIDUAL_STATISTICS_CACHE_KEY = 'invidual-user-statistics';
const INDIVIDUAL_STATISTICS_CACHE_TTL = 60 * 60 * 1000; // 24 hours

export class StatisticsService {
  #userService: UserService;
  #quizService: QuizService;
  #cache: Cache;
  constructor(userService: UserService, quizService: QuizService, cache: Cache) {
    this.#userService = userService;
    this.#quizService = quizService;
    this.#cache = cache;
  }

  /**
   * Gets the individual statistics for all users.
   * @param sortedBy The sorting option to use.
   * @returns An array of users with their statistics.
   *
   * @tags worker
   */
  async getIndividualUserStatistics(
    sortedBy: IndividualUserStatisticsSortOption = 'QUIZZES_COMPLETED_DESC',
  ): Promise<IndividualUserStatistic[]> {
    const cachedResult = await this.#cache.getItem<IndividualUserStatistic[]>(INDIVIDUAL_STATISTICS_CACHE_KEY);
    if (cachedResult) {
      return this.#sortIndividualUserStatistics(cachedResult, sortedBy);
    }

    const results: IndividualUserStatistic[] = [];
    let hasMoreRows = true;
    let cursor: string | undefined = undefined;
    while (hasMoreRows) {
      const { data, hasMoreRows: moreRows } = await this.#userService.getUsers({
        currentUserId: '1', // Current user id isn't valid here and isn't used for sorting by EMAIL_ASC
        first: 100,
        afterId: cursor,
        sortedBy: 'EMAIL_ASC',
      });

      for (const user of data) {
        const { totalQuizCompletions, averageScorePercentage } = await this.#getStatisticsForUser(user.email);
        results.push({
          email: user.email,
          name: user.name,
          totalQuizCompletions,
          averageScorePercentage,
        });
      }

      cursor = data[data.length - 1]?.id;
      hasMoreRows = moreRows;
    }

    await this.#cache.setItem(INDIVIDUAL_STATISTICS_CACHE_KEY, results, INDIVIDUAL_STATISTICS_CACHE_TTL);
    return this.#sortIndividualUserStatistics(results, sortedBy);
  }

  #sortIndividualUserStatistics(
    statistics: IndividualUserStatistic[],
    sortedBy: IndividualUserStatisticsSortOption,
  ): IndividualUserStatistic[] {
    switch (sortedBy) {
      case 'QUIZZES_COMPLETED_DESC':
        return statistics.sort((a, b) => b.totalQuizCompletions - a.totalQuizCompletions);
      case 'AVERAGE_SCORE_DESC':
        return statistics.sort((a, b) => b.averageScorePercentage - a.averageScorePercentage);
      default:
        throw new Error(`Unknown sorting option: ${sortedBy}`);
    }
  }

  /**
   * Get quiz completion statistics for a single user.
   * @param userEmail The email of the user to get statistics for.
   * @returns Total quiz completions and average score percentage for the user.
   *
   * @tags worker
   */
  async #getStatisticsForUser(userEmail: string) {
    let hasMoreRows = true;
    let cursor: string | undefined = undefined;
    const completionsScores: number[] = [];
    while (hasMoreRows) {
      const { stats, cursor: latestCursor } = await this.#quizService.quizScorePercentagesForUser({
        email: userEmail,
        first: 100,
        afterId: cursor,
      });

      completionsScores.push(...stats);

      cursor = latestCursor;
      hasMoreRows = !!latestCursor;
    }

    if (completionsScores.length === 0) {
      return {
        totalQuizCompletions: 0,
        averageScorePercentage: 0,
      };
    }

    return {
      totalQuizCompletions: completionsScores.length,
      averageScorePercentage: completionsScores.reduce((a, b) => a + b, 0) / completionsScores.length,
    };
  }
}
