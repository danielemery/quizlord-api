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
  }

  async getQuizzes({ afterId, limit }: { afterId?: string; limit: number }) {
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
      include: {
        completions: {
          include: {
            completedBy: true,
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

  async getQuizById({ id }: { id: string }) {
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
}

export const persistence = new Persistence();
