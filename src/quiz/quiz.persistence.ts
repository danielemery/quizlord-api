import { Quiz, QuizAIProcessingState, QuizImage, QuizNoteType } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

import { PrismaService } from '../database/prisma.service';
import { slicePagedResults, getPagedQuery } from '../util/paging-helpers';
import { QuizCompletionQuestionResult, QuizFilters, QuizQuestion } from './quiz.dto';

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
        aiProcessingState: true,
        aiProcessingCertaintyPercent: true,
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
        ...(filters.excludeIllegible === 'ME' && {
          notes: {
            none: {
              noteType: 'ILLEGIBLE',
              user: {
                email: userEmail,
              },
            },
          },
        }),
        ...(filters.excludeIllegible === 'ANYONE' && {
          notes: {
            none: {
              noteType: 'ILLEGIBLE',
            },
          },
        }),
      },
    });

    return slicePagedResults(result, limit, afterId !== undefined);
  }

  async getQuizByIdWithResults({ id }: { id: string }) {
    const quizDetails = await this.#prisma.client().quiz.findFirstOrThrow({
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
            questionResults: {
              select: {
                questionId: true,
                score: true,
              },
            },
          },
        },
        images: true,
        uploadedByUser: true,
        questions: {
          orderBy: {
            questionNum: 'asc',
          },
        },
        notes: true,
      },
    });
    return quizDetails;
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

  async allQuizImagesAreReady(quizId: string) {
    /*
     * Once an exists function is implemented for prisma, it should be used instead.
     * https://github.com/prisma/prisma/issues/5022
     */
    const incompleteImage = await this.#prisma.client().quizImage.findFirst({
      where: {
        quizId,
        state: {
          not: 'READY',
        },
      },
    });
    return !incompleteImage;
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
    questionResults?: QuizCompletionQuestionResult[],
  ) {
    const users = await this.#prisma.client().user.findMany({
      where: {
        email: {
          in: completedBy,
        },
      },
    });

    const questions = questionResults?.length
      ? await this.#prisma.client().quizQuestion.findMany({
          select: {
            questionNum: true,
            id: true,
          },
          where: {
            quizId,
          },
        })
      : [];

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
        ...(questionResults && questionResults.length > 0
          ? {
              questionResults: {
                create: questionResults
                  .filter((qr) => {
                    const question = questions.find((q) => q.questionNum === qr.questionNum);
                    return !!question;
                  })
                  .map((qr) => {
                    const question = questions.find((q) => q.questionNum === qr.questionNum);
                    return {
                      id: uuidv4(),
                      score: qr.score,
                      questionId: question!.id,
                    };
                  }),
              },
            }
          : {}),
      },
      include: {
        completedBy: {
          include: {
            user: true,
          },
        },
        questionResults: true,
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

  async addQuizNote({
    quizId,
    noteType,
    userEmail,
    submittedAt,
  }: {
    quizId: string;
    noteType: QuizNoteType;
    userEmail: string;
    submittedAt: Date;
  }) {
    const user = await this.#prisma.client().user.findFirst({
      where: {
        email: userEmail,
      },
    });

    if (!user) {
      throw new Error(`Unable to find user with email ${userEmail}`);
    }

    const noteId = uuidv4();
    await this.#prisma.client().quizNote.create({
      data: {
        id: noteId,
        noteType,
        quizId,
        userId: user.id,
        submittedAt,
      },
    });
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

  getRecentQuizUploads({ limit }: { limit: number }) {
    return this.#prisma.client().quiz.findMany({
      take: limit,
      orderBy: {
        uploadedAt: 'desc',
      },
      include: {
        uploadedByUser: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });
  }

  async upsertQuizQuestionsAfterAIExtraction(
    quizId: string,
    questions: Omit<QuizQuestion, 'id' | 'myScore'>[],
    result: 'ERRORED',
  ): Promise<void>;
  async upsertQuizQuestionsAfterAIExtraction(
    quizId: string,
    questions: Omit<QuizQuestion, 'id' | 'myScore'>[],
    result: 'COMPLETED',
    confidence: number,
  ): Promise<void>;
  async upsertQuizQuestionsAfterAIExtraction(
    quizId: string,
    questions: Omit<QuizQuestion, 'id' | 'myScore'>[],
    result: QuizAIProcessingState,
    confidence?: number,
  ) {
    return this.#prisma.client().$transaction(async (prisma) => {
      // Remove any existing inaccurate OCR notes (since we are replacing the questions)
      await prisma.quizNote.deleteMany({
        where: {
          quizId,
          noteType: 'INACCURATE_OCR',
        },
      });

      // First check if there are existing questions for the quiz (if there are we want to update them)
      // We do this instead of deleting and re-creating them to avoid losing any existing scores or relationships
      const existingQuestions = await prisma.quizQuestion.findMany({
        where: {
          quizId,
        },
      });
      if (existingQuestions.length > 0) {
        // Update existing questions
        for (const question of questions) {
          await prisma.quizQuestion.update({
            where: {
              quizId_questionNum: {
                quizId,
                questionNum: question.questionNum,
              },
            },
            data: {
              question: question.question,
              answer: question.answer,
            },
          });
        }
      } else {
        // If there are no existing questions, we just insert the new ones
        await prisma.quizQuestion.createMany({
          data: questions.map((question) => ({
            id: uuidv4(),
            quizId,
            questionNum: question.questionNum,
            question: question.question,
            answer: question.answer,
          })),
        });
      }

      // Update quiz state
      await prisma.quiz.update({
        data: {
          aiProcessingState: result,
          aiProcessingCertaintyPercent: confidence,
        },
        where: {
          id: quizId,
        },
      });
    });
  }

  async markQuizAIExtractionQueued(quizId: string) {
    return this.#prisma.client().quiz.update({
      data: {
        aiProcessingState: 'QUEUED',
      },
      where: {
        id: quizId,
      },
    });
  }
}
