import { PrismaClient, Quiz as QuizPersistence, QuizImage as QuizImagePersistence, Role, User } from '@prisma/client';
import { types } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { QuizFilters, UserSortOption } from '../models';

export interface PersistenceResult<T> {
  data: T[];
  hasMoreRows: boolean;
}

const DATE_OID = 1082;
const parseDate = (value: string) => {
  return new Date(value);
};
types.setTypeParser(DATE_OID, parseDate);

class Persistence {
  #prisma?: PrismaClient;

  getPrismaClient() {
    if (this.#prisma === undefined) {
      throw new Error('Error attempting to use database before connecting');
    }
    return this.#prisma;
  }

  async connect() {
    if (!this.#prisma) {
      console.log(`Connecting to database`);
      this.#prisma = new PrismaClient();
      try {
        await this.#prisma.$queryRaw`SELECT 1`;
      } catch (err) {
        console.error(err);
        process.exit(1);
      }
      console.log('Connected to database successfully');
    }
  }

  async getQuizzesWithMyResults({
    userEmail,
    afterId,
    limit,
    filters,
  }: {
    userEmail: string;
    afterId?: string;
    limit: number;
    filters: QuizFilters;
  }) {
    const result = await this.getPrismaClient().quiz.findMany({
      ...getPagedQuery(limit, afterId),
      orderBy: {
        date: 'desc',
      },
      select: {
        completions: {
          select: {
            completedAt: true,
            completedBy: {
              include: {
                user: true,
              },
            },
            id: true,
            quizId: true,
            score: true,
          },
          where: {
            completedBy: {
              some: {
                user: {
                  email: userEmail,
                },
              },
            },
          },
        },
        images: true,
        date: true,
        id: true,
        type: true,
        uploadedAt: true,
        uploadedByUserId: true,
        uploadedByUser: true,
      },
      where: {
        ...(filters.excludeCompletedBy && {
          completions: {
            none: {
              completedBy: {
                some: {
                  user: {
                    email: {
                      in: filters.excludeCompletedBy,
                    },
                  },
                },
              },
            },
          },
        }),
      },
    });

    return slicePagedResults(result, limit, afterId !== undefined);
  }

  async getQuizByIdWithResults({ id }: { id: string }) {
    return this.getPrismaClient().quiz.findFirstOrThrow({
      where: {
        id,
      },
      include: {
        completions: {
          include: {
            completedBy: {
              include: {
                user: true,
              },
            },
          },
        },
        images: true,
        uploadedByUser: true,
      },
    });
  }

  async getQuizImage(imageKey: string) {
    return this.getPrismaClient().quizImage.findFirst({
      where: {
        imageKey,
      },
    });
  }

  async markQuizImageReady(imageKey: string) {
    return this.getPrismaClient().quizImage.update({
      data: {
        state: 'READY',
      },
      where: {
        imageKey,
      },
    });
  }

  async createQuizWithImages(
    quiz: QuizPersistence,
    images: Omit<QuizImagePersistence, 'quizId'>[],
  ): Promise<QuizPersistence> {
    return this.getPrismaClient().quiz.create({
      data: {
        ...quiz,
        images: {
          createMany: {
            data: images,
          },
        },
      },
    });
  }

  async createQuizCompletion(
    quizId: string,
    completionId: string,
    completedAt: Date,
    completedBy: string[],
    score: number,
  ) {
    const users = await this.getPrismaClient().user.findMany({
      where: {
        email: {
          in: completedBy,
        },
      },
    });
    const result = await this.getPrismaClient().quizCompletion.create({
      data: {
        completedAt,
        id: completionId,
        score,
        completedBy: {
          create: completedBy.map((userEmail) => {
            const user = users.find((user) => user.email === userEmail);
            if (!user) {
              throw new Error(`Unable to find user with email ${userEmail}`);
            }
            return {
              userId: user.id,
            };
          }),
        },
        quizId,
      },
      include: {
        completedBy: {
          include: {
            user: true,
          },
        },
      },
    });
    return result;
  }

  async loadUserDetailsAndUpdateIfNecessary(
    email: string,
    name: string | undefined,
  ): Promise<{ roles: Role[]; id: string }> {
    const user = await this.getPrismaClient().user.findFirst({
      include: {
        roles: {},
      },
      where: {
        email,
      },
    });

    if (!user) {
      const newUserId = uuidv4();
      await this.getPrismaClient().user.create({
        data: {
          id: newUserId,
          email,
          name,
        },
      });

      return {
        id: newUserId,
        roles: [],
      };
    }

    if (user?.name !== (name ?? null)) {
      await this.getPrismaClient().user.update({ data: { name }, where: { id: user.id } });
    }

    return { roles: user.roles.map((r) => r.role), id: user.id };
  }

  async getUserRoles(email: string): Promise<Role[]> {
    const roles = await this.getPrismaClient().userRole.findMany({
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
        result = await this.getPrismaClient().user.findMany({
          ...pagedWhereQuery,
          orderBy: {
            email: 'asc',
          },
        });
        break;
      case 'NAME_ASC':
        result = await this.getPrismaClient().user.findMany({
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
        result = (await this.getPrismaClient().$queryRaw`
select id, email, name from 
  (
    select "user".*, count(quiz_completion.id) as completions from "user"
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

export function getPagedQuery(limit: number, after?: string) {
  return {
    take: limit + (after === undefined ? 1 : 2),
    ...(after && {
      cursor: {
        id: after,
      },
    }),
  };
}

export function slicePagedResults<T>(
  results: T[],
  limit: number,
  isUsingCursor: boolean,
): { data: T[]; hasMoreRows: boolean } {
  if (isUsingCursor) {
    if (results.length === limit + 2) {
      return {
        data: results.slice(1, limit + 1),
        hasMoreRows: true,
      };
    } else if (results.length > 1) {
      return {
        data: results.slice(1),
        hasMoreRows: false,
      };
    } else {
      return {
        data: [],
        hasMoreRows: false,
      };
    }
  }

  if (results.length === limit + 1) {
    return {
      data: results.slice(0, limit),
      hasMoreRows: true,
    };
  } else {
    return {
      data: results,
      hasMoreRows: false,
    };
  }
}

export const persistence = new Persistence();
