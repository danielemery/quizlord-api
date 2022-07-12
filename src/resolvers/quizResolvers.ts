import {
  Quiz as QuizPersistence,
  QuizCompletion as QuizCompletionPersistence,
  QuizCompletionUser as QuizCompletionUserPersistence,
  User,
} from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { QuizlordContext } from '..';
import { Quiz, QuizDetails, QuizType, QuizCompletion } from '../models';
import { persistence } from '../persistence/persistence';
import { createKey, generateSignedUploadUrl, keyToUrl } from '../s3';
import { base64Decode, base64Encode, PagedResult, requireUserRole } from './helpers';

function quizCompletionPersistenceToQuizCompletion(
  quizCompletion: QuizCompletionPersistence & {
    completedBy: (QuizCompletionUserPersistence & {
      user: User | null;
    })[];
  },
): QuizCompletion {
  const { completedBy, score, ...otherFields } = quizCompletion;
  return {
    ...otherFields,
    completedBy: completedBy.map((user) => {
      if (user.user === null) {
        throw new Error('Persistence incorrectly retrieved non-matching quizCompletion');
      }
      return user.user.email;
    }),
    score: score.toNumber(),
  };
}

function quizPersistenceWithMyCompletionsToQuiz(
  quiz: QuizPersistence & {
    completions: (QuizCompletionPersistence & {
      completedBy: (QuizCompletionUserPersistence & {
        user: User | null;
      })[];
    })[];
  },
): Quiz {
  const { imageKey: _imageKey, completions, ...quizWithoutImageKey } = quiz;
  return {
    ...quizWithoutImageKey,
    myCompletions: completions.map(quizCompletionPersistenceToQuizCompletion),
  };
}

function quizPersistenceWithCompletionsToQuizDetails(
  quiz: QuizPersistence & {
    completions: (QuizCompletionPersistence & {
      completedBy: (QuizCompletionUserPersistence & {
        user: User | null;
      })[];
    })[];
  },
): QuizDetails {
  const { imageKey, completions, ...quizWithoutImageKey } = quiz;
  return {
    ...quizWithoutImageKey,
    ...(quizWithoutImageKey.state !== 'PENDING_UPLOAD' &&
      imageKey !== null && {
        imageLink: keyToUrl(imageKey),
      }),
    completions: completions.map(quizCompletionPersistenceToQuizCompletion),
  };
}

export async function quizzes(
  _: unknown,
  { first = 100, after }: { first: number; after?: string },
  context: QuizlordContext,
): Promise<PagedResult<Quiz>> {
  requireUserRole(context, 'USER');
  const afterId = after ? base64Decode(after) : undefined;
  const { data, hasMoreRows } = await persistence.getQuizzesWithMyResults({
    userEmail: context.email,
    afterId,
    limit: first,
  });
  const edges = data.map((quiz) => ({
    node: quizPersistenceWithMyCompletionsToQuiz(quiz),
    cursor: base64Encode(quiz.id),
  }));
  const result = {
    edges,
    pageInfo: {
      hasNextPage: hasMoreRows,
      startCursor: edges.length > 0 ? edges[0].cursor : undefined,
      endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : undefined,
    },
  };
  return result;
}

export async function quiz(_: unknown, { id }: { id: string }, context: QuizlordContext) {
  requireUserRole(context, 'USER');
  const quiz = await persistence.getQuizByIdWithResults({
    id,
  });
  return quizPersistenceWithCompletionsToQuizDetails(quiz);
}

export async function createQuiz(
  _: unknown,
  { type, date, fileName }: { type: QuizType; date: Date; fileName: string },
  context: QuizlordContext,
): Promise<{ quiz: Quiz; uploadLink: string }> {
  requireUserRole(context, 'USER');
  const uuid = uuidv4();
  const fileKey = createKey(uuid, fileName);
  const [createdQuiz, uploadLink] = await Promise.all([
    persistence.createQuiz({
      id: uuid,
      date,
      type,
      state: 'PENDING_UPLOAD',
      imageKey: fileKey,
      uploadedAt: new Date(),
      uploadedBy: context.email,
    }),
    generateSignedUploadUrl(fileKey),
  ]);
  return {
    quiz: quizPersistenceWithMyCompletionsToQuiz({ ...createdQuiz, completions: [] }),
    uploadLink,
  };
}

export async function completeQuiz(
  _: unknown,
  { quizId, completedBy, score }: { quizId: string; completedBy: string[]; score: number },
  context: QuizlordContext,
): Promise<{ completion: QuizCompletion }> {
  if (!completedBy.includes(context.email)) {
    throw new Error('Can only enter quiz completions which you participate in.');
  }
  requireUserRole(context, 'USER');
  const uuid = uuidv4();
  const completion = await persistence.createQuizCompletion(quizId, uuid, new Date(), completedBy, score);
  return { completion: quizCompletionPersistenceToQuizCompletion(completion) };
}
