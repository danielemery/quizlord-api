import { Quiz, QuizImage } from '@prisma/client';

import { PrismaService } from '../database/prisma.service';
import { QuizFilters } from './quiz.dto';
import { slicePagedResults, getPagedQuery } from '../util/paging-helpers';

export class QuizPersistence {
  #prisma: PrismaService;
  constructor(prisma: PrismaService) {
    this.#prisma = prisma;
  }

  async getQuizzesWithUserResults({
    userEmail,
    afterId,
    limit,
    filters = {},
  }: {
    userEmail: string;
    afterId?: string;
    limit: number;
    filters?: QuizFilters;
  }) {
    const result = await this.#prisma.client().quiz.findMany({
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
    return this.#prisma.client().quiz.findFirstOrThrow({
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
    return this.#prisma.client().quizImage.findFirst({
      where: {
        imageKey,
      },
    });
  }

  async markQuizImageReady(imageKey: string) {
    return this.#prisma.client().quizImage.update({
      data: {
        state: 'READY',
      },
      where: {
        imageKey,
      },
    });
  }

  async createQuizWithImages(quiz: Quiz, images: Omit<QuizImage, 'quizId'>[]): Promise<Quiz> {
    return this.#prisma.client().quiz.create({
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
    const users = await this.#prisma.client().user.findMany({
      where: {
        email: {
          in: completedBy,
        },
      },
    });
    const result = await this.#prisma.client().quizCompletion.create({
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

  async getCompletionScoreWithQuizTypesForUser({
    email,
    afterId,
    limit,
  }: {
    email: string;
    afterId?: string;
    limit: number;
  }) {
    const result = await this.#prisma.client().quizCompletion.findMany({
      ...getPagedQuery(limit, afterId),
      orderBy: {
        id: 'desc',
      },
      where: {
        completedBy: {
          some: {
            user: {
              email,
            },
          },
        },
      },
      include: {
        quiz: {
          select: {
            type: true,
          },
        },
      },
    });
    return slicePagedResults(result, limit, afterId !== undefined);
  }

  async getRecentQuizCompletions({ limit }: { limit: number }) {
    return this.#prisma.client().quizCompletion.findMany({
      take: limit,
      orderBy: {
        completedAt: 'desc',
      },
      include: {
        completedBy: {
          select: {
            user: {
              select: {
                email: true,
                name: true,
              },
            },
          },
        },
        quiz: {
          select: {
            id: true,
            date: true,
            type: true,
          },
        },
      },
    });
  }
}
