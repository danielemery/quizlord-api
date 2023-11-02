import { v4 as uuidv4 } from 'uuid';

import { User as UserPersistenceModel } from '@prisma/client';
import { Role, User, UserSortOption } from './user.dto';
import { UserPersistence } from './user.persistence';

export class UserService {
  #persistence: UserPersistence;
  constructor(persistence: UserPersistence) {
    this.#persistence = persistence;
  }

  async loadUserDetailsAndUpdateIfNecessary(
    email: string,
    name: string | undefined,
  ): Promise<{ roles: Role[]; id: string }> {
    const user = await this.#persistence.getUserByEmail(email);

    if (!user) {
      const newUserId = uuidv4();

      await this.#persistence.createNewUser(newUserId, email, name);

      return {
        id: newUserId,
        roles: [],
      };
    }

    if (name && user?.name !== name) {
      await this.#persistence.updateUserName(user.id, name);
    }

    return { roles: user.roles.map((r) => r.role), id: user.id };
  }

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
    const { data, hasMoreRows } = await this.#persistence.getUsersWithRole({
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

  #userPersistenceToUser(user: UserPersistenceModel): User {
    return {
      id: user.id,
      email: user.email,
      name: user.name ?? undefined,
    };
  }
}
