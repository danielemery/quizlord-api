import { QuizlordContext } from '../index.js';
import { authorisationService, statisticsService } from '../service.locator.js';
import { IndividualUserStatistic, IndividualUserStatisticsSortOption } from './statistics.dto.js';

async function individualUserStatistics(
  _p: unknown,
  { sortedBy }: { sortedBy?: IndividualUserStatisticsSortOption },
  context: QuizlordContext,
): Promise<IndividualUserStatistic[]> {
  authorisationService.requireUserRole(context, 'USER');
  return statisticsService.getIndividualUserStatistics(sortedBy);
}

export const statisticsQueries = {
  individualUserStatistics,
};
