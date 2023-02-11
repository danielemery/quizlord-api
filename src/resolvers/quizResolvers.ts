import {
  Quiz as QuizPersistence,
  QuizCompletion as QuizCompletionPersistence,
  QuizCompletionUser as QuizCompletionUserPersistence,
  QuizImage as QuizImagePersistence,
  QuizImageType,
  QuizType,
  User,
} from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

import { QuizlordContext } from '..';
import { Quiz, QuizDetails, QuizCompletion, QuizImage, CreateQuizResult } from '../models';
import { persistence } from '../persistence/persistence';
import { createKey, generateSignedUploadUrl, keyToUrl } from '../s3';
import { base64Decode, base64Encode, PagedResult, requireUserRole } from './helpers';

function quizImagePersistenceToQuizImage(quizImage: QuizImagePersistence): QuizImage {
  return {
    imageLink: keyToUrl(quizImage.imageKey),
    state: quizImage.state,
    type: quizImage.type,
  };
}

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
      return {
        email: user.user.email,
        name: user.user.name ?? undefined,
      };
    }),
    score: score.toNumber(),
  };
}

function quizPersistenceWithMyCompletionsToQuiz(
  quiz: QuizPersistence & {
    uploadedByUser: User;
    completions: (QuizCompletionPersistence & {
      completedBy: (QuizCompletionUserPersistence & {
        user: User | null;
      })[];
    })[];
  },
): Quiz {
  const { completions, uploadedByUser, ...quizWithoutImageKey } = quiz;
  return {
    ...quizWithoutImageKey,
    myCompletions: completions.map(quizCompletionPersistenceToQuizCompletion),
    uploadedBy: {
      email: uploadedByUser.email,
      name: uploadedByUser.name ?? undefined,
    },
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

export async function quiz(_: unknown, { id }: { id: string }, context: QuizlordContext): Promise<QuizDetails> {
  requireUserRole(context, 'USER');
  const quiz = await persistence.getQuizByIdWithResults({
    id,
  });
  const { images, completions, uploadedByUser, ...quizFieldsThatDoNotRequireTransform } = quiz;
  return {
    ...quizFieldsThatDoNotRequireTransform,
    completions: completions.map(quizCompletionPersistenceToQuizCompletion),
    images: images.map(quizImagePersistenceToQuizImage),
    uploadedBy: {
      email: uploadedByUser.email,
      name: uploadedByUser.name ?? undefined,
    },
  };
}

async function populateFileWithUploadLink(file: { fileName: string; type: QuizImageType; imageKey: string }) {
  const uploadLink = await generateSignedUploadUrl(file.imageKey);
  return {
    ...file,
    uploadLink,
  };
}

export async function createQuiz(
  _: unknown,
  { type, date, files }: { type: QuizType; date: Date; files: { fileName: string; type: QuizImageType }[] },
  context: QuizlordContext,
): Promise<CreateQuizResult> {
  requireUserRole(context, 'USER');
  const uuid = uuidv4();
  const filesWithKeys = files.map((file) => ({ ...file, imageKey: createKey(uuid, file.fileName) }));
  const [createdQuiz, ...uploadLinks] = await Promise.all([
    persistence.createQuizWithImages(
      {
        id: uuid,
        date,
        type,
        uploadedAt: new Date(),
        uploadedByUserId: context.userId,
      },
      filesWithKeys.map((file) => ({
        imageKey: file.imageKey,
        type: file.type,
        state: 'PENDING_UPLOAD',
      })),
    ),
    ...filesWithKeys.map(populateFileWithUploadLink),
  ]);
  return {
    quiz: quizPersistenceWithMyCompletionsToQuiz({
      ...createdQuiz,
      completions: [],
      uploadedByUser: {
        id: context.userId,
        email: context.email,
        name: context.userName ?? null,
      },
    }),
    uploadLinks: uploadLinks.map((ul) => ({ fileName: ul.fileName, link: ul.uploadLink })),
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
