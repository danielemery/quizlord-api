import { PrismaClient, Quiz as QuizPersistence, Role } from '@prisma/client';
import { types } from 'pg';

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

  #getPrisma() {
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

  async getQuizzesWithMyResults({ userEmail, afterId, limit }: { userEmail: string; afterId?: string; limit: number }) {
    const result = await this.#getPrisma().quiz.findMany({
      take: limit + 1,
      ...(afterId && {
        cursor: {
          id: afterId,
        },
      }),
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
        date: true,
        id: true,
        imageKey: true,
        state: true,
        type: true,
        uploadedAt: true,
        uploadedBy: true,
      },
    });

    return slicePagedResults(result, limit, afterId !== undefined);
  }

  async getQuizByIdWithResults({ id }: { id: string }) {
    return this.#getPrisma().quiz.findFirstOrThrow({
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
      },
    });
  }

  async getQuizByImageKey(imageKey: string) {
    return this.#getPrisma().quiz.findFirst({
      where: {
        imageKey,
      },
    });
  }

  async markQuizReady(id: string) {
    return this.#getPrisma().quiz.update({
      data: {
        state: 'READY',
      },
      where: {
        id,
      },
    });
  }

  async createQuiz(quiz: QuizPersistence): Promise<QuizPersistence> {
    return this.#getPrisma().quiz.create({
      data: quiz,
    });
  }

  async createQuizCompletion(
    quizId: string,
    completionId: string,
    completedAt: Date,
    completedBy: string[],
    score: number,
  ) {
    const users = await this.#getPrisma().user.findMany({
      where: {
        email: {
          in: completedBy,
        },
      },
    });
    const result = await this.#getPrisma().quizCompletion.create({
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

  async getUserRoles(email: string): Promise<Role[]> {
    const roles = await this.#getPrisma().userRole.findMany({
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

  async getUsersWithRole({ role, afterId, limit }: { role: Role; afterId?: string; limit: number }) {
    const result = await this.#getPrisma().user.findMany({
      take: limit + (afterId === undefined ? 1 : 2),
      ...(afterId && {
        cursor: {
          id: afterId,
        },
      }),
      where: {
        roles: {
          some: {
            role,
          },
        },
      },
      orderBy: {
        email: 'asc',
      },
    });

    return slicePagedResults(result, limit, afterId !== undefined);
  }
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
