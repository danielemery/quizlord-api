import DataLoader from 'dataloader';

import { QuizlordContext } from '..';
import { authorisationService, activityService, userService } from '../service.locator';
import { RecentActivityItem } from './activity.service';

async function activityFeed(_: unknown, _params: Record<string, never>, context: QuizlordContext) {
  authorisationService.requireUserRole(context, 'USER');

  return activityService.getRecentActivity();
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function activityFeedUser(parent: RecentActivityItem, _params: Record<string, never>, _context: QuizlordContext) {
  return usersForActivityLoader.load(parent);
}

export const activityQueries = {
  activityFeed,
};

export const activityChildren = {
  users: activityFeedUser,
};

async function batchUsersForActivities(activityItems: readonly RecentActivityItem[]) {
  const users = await userService.getUsersForActivities(activityItems);
  return activityItems.map((activityItem) => users[activityItem.resourceId] || []);
}

// Create DataLoader instance
export const usersForActivityLoader = new DataLoader(batchUsersForActivities);
