import { Quiz, QuizType } from "../models";
import { persistence, QuizPersistence } from "../persistence/persistence";
import { v4 as uuidv4 } from "uuid";
import { createKey, generateSignedUploadUrl, keyToUrl } from "../s3";
import { base64Decode, base64Encode, PagedResult } from "./helpers";
import { QuizlordContext } from "..";

function quizPersistenceToQuiz(quiz: QuizPersistence): Quiz {
  const { image_key, created_at, created_by, ...quizWithoutImageKey } = quiz;
  return {
    ...quizWithoutImageKey,
    ...(quizWithoutImageKey.state !== "PENDING_UPLOAD" && {
      imageLink: keyToUrl(image_key),
    }),
    uploadedAt: created_at,
    uploadedBy: created_by,
  };
}

export async function quizzes(
  _: any,
  { first = 100, after }: { first: number; after?: string },
  context: QuizlordContext
): Promise<PagedResult<Quiz>> {
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

export async function quiz(
  _: any,
  { id }: { id: string },
  context: QuizlordContext
) {
  const quiz = await persistence.getQuizById({ id });
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
      image_key: fileKey,
      created_at: new Date(),
      created_by: context.email,
    }),
    generateSignedUploadUrl(fileKey),
  ]);
  return {
    quiz: quizPersistenceToQuiz(createdQuiz),
    uploadLink,
  };
}
