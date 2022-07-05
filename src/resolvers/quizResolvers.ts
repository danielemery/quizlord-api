import { Quiz, QuizType, QuizCompletion } from "../models";
import { persistence } from "../persistence/persistence";
import { v4 as uuidv4 } from "uuid";
import { createKey, generateSignedUploadUrl, keyToUrl } from "../s3";
import { base64Decode, base64Encode } from "./helpers";
import { QuizlordContext } from "..";
import {
  Quiz as QuizPersistence,
  QuizCompletion as QuizCompletionPersistence,
  QuizCompletionUser as QuizCompletionUserPersistence,
} from "@prisma/client";

function quizCompletionPersistenceToQuizCompletion(
  quizCompletion: QuizCompletionPersistence & {
    completedBy: QuizCompletionUserPersistence[];
  }
): QuizCompletion {
  const { completedBy, score, ...otherFields } = quizCompletion;
  return {
    ...otherFields,
    completedBy: completedBy.map((user) => user.userEmail),
    score: score.toNumber(),
  };
}

function quizPersistenceToQuiz(
  quiz: QuizPersistence & {
    completions: (QuizCompletionPersistence & {
      completedBy: QuizCompletionUserPersistence[];
    })[];
  }
): Quiz {
  const { imageKey, completions, ...quizWithoutImageKey } = quiz;
  return {
    ...quizWithoutImageKey,
    ...(quizWithoutImageKey.state !== "PENDING_UPLOAD" &&
      imageKey !== null && {
        imageLink: keyToUrl(imageKey),
      }),
    myCompletions: completions.map(quizCompletionPersistenceToQuizCompletion),
  };
}

export async function quizzes(
  _: any,
  { first = 10, after }: { first: number; after?: string },
  context: QuizlordContext
) {
  const afterId = after ? base64Decode(after) : undefined;
  const { data, hasMoreRows } = await persistence.getQuizzesWithMyResults({
    userEmail: context.email,
    afterId,
    limit: first,
  });
  const edges = data.map((quiz) => ({
    node: quizPersistenceToQuiz(quiz),
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

export async function quiz(
  _: any,
  { id }: { id: string },
  context: QuizlordContext
) {
  const quiz = await persistence.getQuizByIdWithMyResults({
    id,
    userEmail: context.email,
  });
  return quizPersistenceToQuiz(quiz);
}

export async function createQuiz(
  _: any,
  { type, date, fileName }: { type: QuizType; date: Date; fileName: string },
  context: QuizlordContext
): Promise<{ quiz: Quiz; uploadLink: string }> {
  const uuid = uuidv4();
  const fileKey = createKey(uuid, fileName);
  const [createdQuiz, uploadLink] = await Promise.all([
    persistence.createQuiz({
      id: uuid,
      date,
      type,
      state: "PENDING_UPLOAD",
      imageKey: fileKey,
      uploadedAt: new Date(),
      uploadedBy: context.email,
    }),
    generateSignedUploadUrl(fileKey),
  ]);
  return {
    quiz: quizPersistenceToQuiz({ ...createdQuiz, completions: [] }),
    uploadLink,
  };
}

export async function completeQuiz(
  _: any,
  {
    quizId,
    completedBy,
    score,
  }: { quizId: string; completedBy: string[]; score: number },
  context: QuizlordContext
): Promise<{ completion: QuizCompletion }> {
  const uuid = uuidv4();
  const completion = await persistence.createQuizCompletion(
    quizId,
    uuid,
    new Date(),
    completedBy,
    score
  );
  return { completion: quizCompletionPersistenceToQuizCompletion(completion) };
}
