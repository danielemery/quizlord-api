import { Role, User } from '@prisma/client';

import { PrismaService } from '../database/prisma.service';
import { UserSortOption } from '../user/user.dto';
import { getPagedQuery, slicePagedResults } from '../util/paging-helpers';
import { RecentActivityItem } from '../activity/activity.service';

export interface GetUsersWithRoleResult {
  data: {
    id: string;
    email: string;
    name: string | null;
  }[];
  hasMoreRows: boolean;
}

export class UserPersistence {
  #prisma: PrismaService;
  constructor(prisma: PrismaService) {
    this.#prisma = prisma;
  }

  async getUserByEmail(email: string) {
    if (!email) return null;
    return this.#prisma.client().user.findFirst({
      include: {
        roles: {},
      },
      where: {
        email,
      },
    });
  }

  async getUserById(id: string) {
    if (!id) return null;
    return this.#prisma.client().user.findFirst({
      where: {
        id,
      },
    });
  }

  async createNewUser(id: string, email: string, name: string | undefined) {
    await this.#prisma.client().user.create({
      data: {
        id,
        email,
        name,
      },
    });
  }

  async updateUserName(id: string, name: string) {
    await this.#prisma.client().user.update({
      data: {
        name,
      },
      where: {
        id,
      },
    });
  }

  async getUserRoles(email: string): Promise<Role[]> {
    const roles = await this.#prisma.client().userRole.findMany({
      select: {
        role: true,
      },
      where: {
        user: {
          email,
        },
      },
    });
    return roles.map((r) => r.role);
  }

  /**
   * Get a list of users with the given role sorted by the provided option.
   * @param arguments Query parameters.
   * @returns A list of users with the given role and flag indicating if there are more.
   */
  async getUsersWithRole({
    role,
    afterId,
    limit,
    sortedBy,
  }: {
    /** Only users with this role will be returned. */
    role: Role;
    /** If provided, will be used as a cursor. */
    afterId?: string;
    /** The number of users to load. */
    limit: number;
    /**
     * The sorting option to use.
     * Note if you want to sort by NUMBER_OF_QUIZZES_COMPLETED_WITH_DESC please see
     * getUsersWithRoleSortedByNumberOfQuizzesCompletedWith.
     */
    sortedBy: Omit<UserSortOption, 'NUMBER_OF_QUIZZES_COMPLETED_WITH_DESC'>;
  }): Promise<GetUsersWithRoleResult> {
    const pagedWhereQuery = {
      ...getPagedQuery(limit, afterId),
      where: {
        roles: {
          some: {
            role,
          },
        },
      },
    };

    let result;
    switch (sortedBy) {
      case 'EMAIL_ASC':
      default:
        result = await this.#prisma.client().user.findMany({
          ...pagedWhereQuery,
          orderBy: {
            email: 'asc',
          },
        });
        break;
      case 'NAME_ASC':
        result = await this.#prisma.client().user.findMany({
          ...pagedWhereQuery,
          orderBy: {
            name: 'asc',
          },
        });
        break;
    }

    return slicePagedResults(result, limit, afterId !== undefined);
  }

  /**
   * Special variant of getUsersWithRole which sorts by the number of quizzes completed with the provided user.
   *
   * Note this was split out from getUsersWithRole because it requires dropping down to a raw query and has the
   * additional requirement of the current user's id.
   *
   * @param arguments Query parameters.
   * @returns List of users with the given role, sorted by the number of quizzes completed with provided user.
   */
  async getUsersWithRoleSortedByNumberOfQuizzesCompletedWith({
    role,
    afterId,
    limit,
    currentUserId,
  }: {
    /** Only users with this role will be returned. */
    role: Role;
    /** Optional user id to use as a cursor. */
    afterId?: string;
    /** The number of users to load. */
    limit: number;
    /** The id of the user to use to sort. */
    currentUserId: string;
  }): Promise<GetUsersWithRoleResult> {
    /**
     * Prisma does not yet support ordering by a relation with anything other than count.
     * We need to do something quite a bit more complex so we drop down to a raw query.
     */
    const result = (await this.#prisma.client().$queryRaw`
  select id, email, name from 
    (
      select "user".*, count(my_completion.user_id) as completions from "user"
      inner join user_role on "user".id = user_role.user_id and user_role.role::text = ${role}
      left outer join quiz_completion_user as their_completion on "user".id = their_completion.user_id
      left outer join quiz_completion on their_completion.quiz_completion_id = quiz_completion.id
      left outer join quiz_completion_user as my_completion on my_completion.quiz_completion_id = quiz_completion.id and my_completion.user_id = ${currentUserId}
      group by "user".id
    ) as completions_with_current_user
  order by completions_with_current_user.completions desc;
          `) as User[];
    return slicePagedResults(result, limit, afterId !== undefined);
  }

  /**
   * Get all the users that participated in the quiz completion with the given id.
   * @param quizCompletionId The id of the quiz completion to get users for.
   * @returns The users that participated in the quiz completion with the given id.
   */
  getUsersForQuizCompletion(quizCompletionId: string) {
    return this.#prisma.client().user.findMany({
      where: {
        quizCompletions: {
          some: {
            quizCompletionId: quizCompletionId,
          },
        },
      },
    });
  }

  /**
   * Get the user that uploaded the quiz with the given id.
   * @param quizId The id of the quiz to get the upload user for.
   * @returns The user that uploaded the quiz with the given id.
   */
  getUserForQuizUpload(quizId: string) {
    return this.#prisma.client().user.findFirst({
      where: {
        uploadedQuizzes: {
          some: {
            id: quizId,
          },
        },
      },
    });
  }

  async getUsersForQuizUploads(quizUploadActivityItems: RecentActivityItem[]): Promise<Record<string, User[]>> {
    const result = await this.#prisma.client().quiz.findMany({
      where: {
        id: {
          in: quizUploadActivityItems.map((item) => item.resourceId),
        },
      },
      include: {
        uploadedByUser: true,
      },
    });
    return result.reduce<Record<string, User[]>>((acc, quiz) => {
      acc[quiz.id] = [quiz.uploadedByUser];
      return acc;
    }, {});
  }

  async getUsersForQuizCompletions(quizCompletionActivityItems: RecentActivityItem[]): Promise<Record<string, User[]>> {
    const result = await this.#prisma.client().quizCompletion.findMany({
      where: {
        id: {
          in: quizCompletionActivityItems.map((item) => item.resourceId),
        },
      },
      include: {
        completedBy: {
          include: {
            user: true,
          },
        },
      },
    });
    return result.reduce<Record<string, User[]>>((acc, quizCompletion) => {
      const users = quizCompletion.completedBy.map((cb) => cb.user);
      return {
        ...acc,
        [quizCompletion.id]: users,
      };
    }, {});
  }
}
