import { QuizlordContext } from '..';
import { authorisationService, activityService } from '../service.locator';

async function activityFeed(_: unknown, _params: Record<string, never>, context: QuizlordContext) {
  authorisationService.requireUserRole(context, 'USER');

  return activityService.getRecentActivity();
}

export const activityQueries = {
  activityFeed,
};
