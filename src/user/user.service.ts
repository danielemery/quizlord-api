import { v4 as uuidv4 } from 'uuid';
import { User as UserPersistenceModel, Role as RolePersistenceModel } from '@prisma/client';

import { Role, User, UserSortOption } from './user.dto';
import { UserPersistence } from './user.persistence';
import { UserNotFoundError } from './user.errors';

export interface GetUsersResult {
  data: User[];
  hasMoreRows: boolean;
}

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

  /**
   * Get a page of users sorted by the given option.
   * @param first The number of users to return.
   * @param sortedBy The sorting option to use.
   * @param currentUserId User id to use to compute the number of quizzes completed with.
   * @param afterId Optional cursor to return users after.
   */
  async getUsers(
    first: number,
    sortedBy: 'NUMBER_OF_QUIZZES_COMPLETED_WITH_DESC',
    currentUserId: string,
    afterId?: string,
  ): Promise<GetUsersResult>;
  /**
   * Get a page of users sorted by the given option.
   * @param first The number of users to return.
   * @param sortedBy The sorting option to use.
   * @param afterId Optional cursor to return users after.
   */
  async getUsers(
    first: number,
    sortedBy: Omit<UserSortOption, 'NUMBER_OF_QUIZZES_COMPLETED_WITH_DESC'>,
    afterId?: string,
  ): Promise<GetUsersResult>;
  async getUsers(
    first: number,
    sortedBy: UserSortOption,
    afterIdOrCurrentUserId?: string,
    maybeAfterId?: string,
  ): Promise<GetUsersResult> {
    let data: UserPersistenceModel[];
    let hasMoreRows: boolean;

    if (sortedBy === 'NUMBER_OF_QUIZZES_COMPLETED_WITH_DESC' && afterIdOrCurrentUserId) {
      const result = await this.#persistence.getUsersWithRoleSortedByNumberOfQuizzesCompletedWith({
        role: RolePersistenceModel.USER,
        afterId: maybeAfterId,
        limit: first,
        currentUserId: afterIdOrCurrentUserId,
      });
      data = result.data;
      hasMoreRows = result.hasMoreRows;
    } else {
      const result = await this.#persistence.getUsersWithRole({
        role: RolePersistenceModel.USER,
        afterId: afterIdOrCurrentUserId,
        limit: first,
        sortedBy,
      });
      data = result.data;
      hasMoreRows = result.hasMoreRows;
    }

    return {
      data: data.map((user) => this.#userPersistenceToUser(user)),
      hasMoreRows,
    };
  }

  /**
   * Get the user with the given id.
   * @param userId The id to load the user for.
   * @returns The user with the given id.
   * @throws UserNotFoundError when no user exists with the given id.
   */
  async getUser(userId: string) {
    const persistenceUser = await this.#persistence.getUserById(userId);
    if (persistenceUser === null) {
      throw new UserNotFoundError(`No user found with id ${userId}`);
    }
    return this.#userPersistenceToUser(persistenceUser);
  }

  #userPersistenceToUser(user: UserPersistenceModel): User {
    return {
      id: user.id,
      email: user.email,
      name: user.name ?? undefined,
    };
  }
}
