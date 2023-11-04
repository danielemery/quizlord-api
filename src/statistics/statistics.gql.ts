import { QuizlordContext } from '..';
import { authorisationService, statisticsService } from '../service.locator';
import { IndividualUserStatistic } from './statistics.dto';

async function individualUserStatistics(
  _p: unknown,
  _: void,
  context: QuizlordContext,
): Promise<IndividualUserStatistic[]> {
  authorisationService.requireUserRole(context, 'USER');
  return statisticsService.getIndividualUserStatistics();
}

export const statisticsQueries = {
  individualUserStatistics,
};
