import { types } from "pg";

import { PrismaClient, Quiz as QuizPersistence } from "@prisma/client";

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
    this.#prisma.$queryRaw`SELECT 1`.catch((dbError) => {
      console.log(dbError);
      process.exit(1);
    });
  }

  async getQuizzesWithMyResults({
    userEmail,
    afterId,
    limit,
  }: {
    userEmail: string;
    afterId?: string;
    limit: number;
  }) {
    const result = await this.#prisma.quiz.findMany({
      take: limit + 1,
      ...(afterId && {
        cursor: {
          id: afterId,
        },
      }),
      orderBy: {
        date: "desc",
      },
      select: {
        completions: {
          include: {
            completedBy: true,
          },
          where: {
            completedBy: {
              some: {
                userEmail,
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

  async getQuizByIdWithResults({ id }: { id: string; userEmail: string }) {
    return this.#prisma.quiz.findFirstOrThrow({
      where: {
        id,
      },
      include: {
        completions: {
          include: {
            completedBy: true,
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
        state: "READY",
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
    score: number
  ) {
    const result = await this.#prisma.quizCompletion.create({
      data: {
        completedAt,
        id: completionId,
        score,
        completedBy: {
          create: completedBy.map((userEmail) => ({ userEmail })),
        },
        quizId,
      },
      include: {
        completedBy: true,
      },
    });
    return result;
  }
}

export const persistence = new Persistence();
