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
  #prisma: PrismaClient;

  constructor() {
    console.log(`Connecting to database`);
    this.#prisma = new PrismaClient();
    this.#prisma.$queryRaw`SELECT 1`
      .then(() => console.log('Connected to database successfully'))
      .catch((dbError) => {
        console.log(dbError);
        process.exit(1);
      });
  }

  async getQuizzesWithMyResults({ userEmail, afterId, limit }: { userEmail: string; afterId?: string; limit: number }) {
    const result = await this.#prisma.quiz.findMany({
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

    if (result.length > limit) {
      return {
        data: result.slice(0, limit),
        hasMoreRows: true,
      };
    } else {
      return {
        data: result,
        hasMoreRows: false,
      };
    }
  }

  async getQuizByIdWithResults({ id }: { id: string }) {
    return this.#prisma.quiz.findFirstOrThrow({
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
    return this.#prisma.quiz.findFirst({
      where: {
        imageKey,
      },
    });
  }

  async markQuizReady(id: string) {
    return this.#prisma.quiz.update({
      data: {
        state: 'READY',
      },
      where: {
        id,
      },
    });
  }

  async createQuiz(quiz: QuizPersistence): Promise<QuizPersistence> {
    return this.#prisma.quiz.create({
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
    const users = await this.#prisma.user.findMany({
      where: {
        email: {
          in: completedBy,
        },
      },
    });
    const result = await this.#prisma.quizCompletion.create({
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

  async getUsersWithRole({ role, afterId, limit }: { role: Role; afterId?: string; limit: number }) {
    const result = await this.#prisma.user.findMany({
      take: limit + 1,
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
    });

    if (result.length > limit) {
      return {
        data: result.slice(0, limit),
        hasMoreRows: true,
      };
    } else {
      return {
        data: result,
        hasMoreRows: false,
      };
    }
  }
}

export const persistence = new Persistence();
