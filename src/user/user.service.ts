import { v4 as uuidv4 } from 'uuid';
import { User as UserPersistenceModel } from '@prisma/client';

import { Role, User, UserSortOption } from './user.dto';
import { UserPersistence } from './user.persistence';

export class UserService {
  #persistence: UserPersistence;
  constructor(persistence: UserPersistence) {
    this.#persistence = persistence;
  }

  /**
   * Load user details based on the provided email.
   * If the user does not exist, create a new user.
   * If the user's name has changed, it will be updated.
   *
   * @param email The email to load the user by.
   * @param name Optionally the user's name.
   * @returns The resulting user's roles and id.
   */
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

  // TODO overload this function to only require the currentUserId parameter when the sortedBy parameter is
  // NUMBER_OF_QUIZZES_COMPLETED_WITH_DESC
  async getUsers({
    currentUserId,
    first,
    afterId,
    sortedBy,
  }: {
    currentUserId: string;
    first: number;
    afterId?: string;
    sortedBy: UserSortOption;
  }) {
    const { data, hasMoreRows } = await this.#persistence.getUsersWithRole({
      role: 'USER',
      afterId,
      limit: first,
      sortedBy,
      currentUserId,
    });
    return {
      data: data.map((user) => this.#userPersistenceToUser(user)),
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
