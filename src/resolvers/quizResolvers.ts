import { Quiz, QuizType } from "../models";
import { persistence, QuizPersistence } from "../persistence/persistence";
import { v4 as uuidv4 } from "uuid";
import { createKey, generateSignedUploadUrl, keyToUrl } from "../s3";
import { base64Decode, base64Encode } from "./helpers";

function quizPersistenceToQuiz(quiz: QuizPersistence): Quiz {
  const { imageKey, ...quizWithoutImageKey } = quiz;
  return {
    ...quizWithoutImageKey,
    imageLink: keyToUrl(imageKey),
  };
}

export async function quizzes(
  _: any,
  { first = 10, after }: { first: number; after?: string }
) {
  const afterId = after ? base64Decode(after) : undefined;
  const { data, hasMoreRows } = await persistence.getQuizzes({
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

export async function quiz(_: any, { id }: { id: string }) {
  const quiz = await persistence.getQuizById({ id });
  return quizPersistenceToQuiz(quiz);
}

export async function createQuiz(
  _: any,
  { type, date, fileName }: { type: QuizType; date: Date; fileName: string }
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
    }),
    generateSignedUploadUrl(fileKey),
  ]);
  const { imageKey: _imageKey, ...quizWithoutImageKey } = createdQuiz;
  return {
    quiz: quizWithoutImageKey,
    uploadLink,
  };
}
