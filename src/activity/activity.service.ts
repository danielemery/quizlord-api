import { UnhandledError } from '../util/common.errors';

export interface RecentActivityItem {
  text: string;
  action?: {
    name: string;
    link: string;
  };
}

export class ActivityService {
  /**
   * Get a formatted string list of users.
   * @param users List of userlike objects (contain and email and optionally a name)
   * @returns A formatted string list of users.
   */
  userListToString(
    users: {
      name?: string;
      email: string;
    }[],
  ) {
    if (users.length === 0) {
      throw new UnhandledError('Cannot format an empty user list');
    }
    const names = users.map((user) => user.name ?? user.email);
    if (names.length === 1) {
      return names[0];
    }
    return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
  }
}
