import { Role, User } from '@prisma/client';

import { PrismaService } from '../database/prisma.service';
import { UserSortOption } from '../user/user.dto';
import { getPagedQuery, slicePagedResults } from '../util/paging-helpers';

export class UserPersistence {
  #prisma: PrismaService;
  constructor(prisma: PrismaService) {
    this.#prisma = prisma;
  }

  async getUserByEmail(email: string) {
    return this.#prisma.client().user.findFirst({
      include: {
        roles: {},
      },
      where: {
        email,
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

  async getUsersWithRole({
    role,
    afterId,
    limit,
    sortedBy,
    currentUserId,
  }: {
    role: Role;
    afterId?: string;
    limit: number;
    sortedBy: UserSortOption;
    currentUserId: string;
  }) {
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
      case 'NUMBER_OF_QUIZZES_COMPLETED_WITH_DESC':
      default:
        /**
         * Prisma does not yet support ordering by a relation with anything other than count.
         * We need to do something quite a bit more complex.
         */
        result = (await this.#prisma.client().$queryRaw`
select id, email, name from 
  (
    select "user".*, count(my_completion.user_id) as completions from "user"
    left outer join quiz_completion_user as their_completion on "user".id = their_completion.user_id
    left outer join quiz_completion on their_completion.quiz_completion_id = quiz_completion.id
    left outer join quiz_completion_user as my_completion on my_completion.quiz_completion_id = quiz_completion.id and my_completion.user_id = ${currentUserId}
    group by "user".id
  ) as completions_with_current_user
order by completions_with_current_user.completions desc;
        `) as User[];
        break;
    }

    return slicePagedResults(result, limit, afterId !== undefined);
  }
}
