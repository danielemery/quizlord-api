import { QuizlordContext } from '..';
import { authorisationService, statisticsService } from '../service.locator';
import { IndividualUserStatistic, IndividualUserStatisticsSortOption } from './statistics.dto';

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
