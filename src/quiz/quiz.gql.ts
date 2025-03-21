import { QuizlordContext } from '..';
import { authorisationService, quizService, queuePublisherService } from '../service.locator';
import { base64Decode, base64Encode, PagedResult } from '../util/paging-helpers';
import { CreateQuizResult, Quiz, QuizCompletion, QuizDetails, QuizFilters, QuizImageType, QuizType } from './quiz.dto';

async function quizzes(
  _: unknown,
  { first = 100, after, filters = {} }: { first: number; after?: string; filters: QuizFilters },
  context: QuizlordContext,
): Promise<PagedResult<Quiz>> {
  authorisationService.requireUserRole(context, 'USER');
  const afterId = after ? base64Decode(after) : undefined;
  const { data, hasMoreRows } = await quizService.getQuizzesWithUsersResults(context.email, first, afterId, filters);
  const edges = data.map((quiz) => ({
    node: quiz,
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

async function quiz(_: unknown, { id }: { id: string }, context: QuizlordContext): Promise<QuizDetails> {
  authorisationService.requireUserRole(context, 'USER');
  return quizService.getQuizDetails(id);
}

async function createQuiz(
  _: unknown,
  { type, date, files }: { type: QuizType; date: Date; files: { fileName: string; type: QuizImageType }[] },
  context: QuizlordContext,
): Promise<CreateQuizResult> {
  authorisationService.requireUserRole(context, 'USER');
  return quizService.createQuiz(context.userId, {
    type,
    date,
    files,
  });
}

async function completeQuiz(
  _: unknown,
  { quizId, completedBy, score }: { quizId: string; completedBy: string[]; score: number },
  context: QuizlordContext,
): Promise<{ completion: QuizCompletion }> {
  authorisationService.requireUserRole(context, 'USER');
  return quizService.completeQuiz({
    email: context.email,
    quizId,
    completedBy,
    score,
  });
}

async function markQuizIllegible(
  _: unknown,
  { quizId }: { quizId: string },
  context: QuizlordContext,
): Promise<boolean> {
  authorisationService.requireUserRole(context, 'USER');
  quizService.markQuizIllegible(quizId, context.email);
  return true;
}

async function aiProcessQuizImages(_: unknown, { quizId }: { quizId: string }, context: QuizlordContext) {
  authorisationService.requireUserRole(context, 'ADMIN');
  await queuePublisherService.queueAiProcessing(quizId);
  return true;
}

export const quizQueries = {
  quizzes,
  quiz,
};
export const quizMutations = {
  createQuiz,
  completeQuiz,
  markQuizIllegible,
  aiProcessQuizImages,
};
