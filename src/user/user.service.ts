import { User as UserPersistence } from '@prisma/client';
import { User, UserSortOption } from '../models';
import { persistence } from '../persistence/persistence';

export class UserService {
  async getUsers({
    userId,
    first,
    afterId,
    sortedBy,
  }: {
    userId: string;
    first: number;
    afterId?: string;
    sortedBy: UserSortOption;
  }) {
    const { data, hasMoreRows } = await persistence.getUsersWithRole({
      role: 'USER',
      afterId,
      limit: first,
      sortedBy,
      currentUserId: userId,
    });
    return {
      data: data.map(this.#userPersistenceToUser),
      hasMoreRows,
    };
  }

  #userPersistenceToUser(user: UserPersistence): User {
    return {
      id: user.id,
      email: user.email,
      name: user.name ?? undefined,
    };
  }
}
