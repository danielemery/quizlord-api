import { v4 as uuidv4 } from 'uuid';
import {
  Quiz as QuizPersistenceModel,
  QuizCompletion as QuizCompletionPersistenceModel,
  QuizCompletionUser as QuizCompletionUserPersistenceModel,
  QuizImage as QuizImagePersistenceModel,
  User as UserPersistenceModel,
  QuizImageType,
  QuizType,
} from '@prisma/client';

import { Quiz, QuizCompletion, QuizFilters, QuizImage } from './quiz.dto';
import { S3FileService } from '../file/s3.service';
import { QuizPersistence } from './quiz.persistence';

const MAXIMUM_QUIZ_PAGE_SIZE = 100;

export class QuizService {
  #persistence: QuizPersistence;
  #fileService: S3FileService;

  constructor(persistence: QuizPersistence, fileService: S3FileService) {
    this.#persistence = persistence;
    this.#fileService = fileService;
  }

  /**
   * Get a paginated list of quizzes along with their completions of it for a user.
   * @param email The email of the user to get quizzes for.
   * @param first The number of quizzes to get, defaults to the maximum of 100.
   * @param afterId Optionally an id to use as a cursor to get quizzes after.
   * @param filters Optionally filters to apply to the quizzes.
   * @returns A list of quizzes for the user and a cursor to load the next set of quizzes.
   */
  async getQuizzesWithUsersResults(
    email: string,
    first: number = MAXIMUM_QUIZ_PAGE_SIZE,
    afterId?: string,
    filters?: QuizFilters,
  ) {
    const { data, hasMoreRows } = await this.#persistence.getQuizzesWithUserResults({
      userEmail: email,
      afterId,
      limit: first,
      filters,
    });
    return { data: data.map((entry) => this.#quizPersistenceWithMyCompletionsToQuiz(entry)), hasMoreRows };
  }

  async getQuizDetails(id: string) {
    const quiz = await this.#persistence.getQuizByIdWithResults({
      id,
    });
    const { images, completions, uploadedByUser, ...quizFieldsThatDoNotRequireTransform } = quiz;
    return {
      ...quizFieldsThatDoNotRequireTransform,
      completions: completions.map((entry) => this.#quizCompletionPersistenceToQuizCompletion(entry)),
      images: images.map((entry) => this.#quizImagePersistenceToQuizImage(entry)),
      uploadedBy: {
        id: uploadedByUser.id,
        email: uploadedByUser.email,
        name: uploadedByUser.name ?? undefined,
      },
    };
  }

  async createQuiz({
    userId,
    email,
    userName,
    type,
    date,
    files,
  }: {
    userId: string;
    email: string;
    userName?: string;
    type: QuizType;
    date: Date;
    files: { fileName: string; type: QuizImageType }[];
  }) {
    const uuid = uuidv4();
    const filesWithKeys = files.map((file) => ({
      ...file,
      imageKey: this.#fileService.createKey(uuid, file.fileName),
    }));
    const [createdQuiz, ...uploadLinks] = await Promise.all([
      this.#persistence.createQuizWithImages(
        {
          id: uuid,
          date,
          type,
          uploadedAt: new Date(),
          uploadedByUserId: userId,
        },
        filesWithKeys.map((file) => ({
          imageKey: file.imageKey,
          type: file.type,
          state: 'PENDING_UPLOAD',
        })),
      ),
      ...filesWithKeys.map((entry) => this.#populateFileWithUploadLink(entry)),
    ]);
    return {
      quiz: this.#quizPersistenceWithMyCompletionsToQuiz({
        ...createdQuiz,
        completions: [],
        uploadedByUser: {
          id: userId,
          email: email,
          name: userName ?? null,
        },
      }),
      uploadLinks: uploadLinks.map((ul) => ({ fileName: ul.fileName, link: ul.uploadLink })),
    };
  }

  async completeQuiz({
    email,
    quizId,
    completedBy,
    score,
  }: {
    email: string;
    quizId: string;
    completedBy: string[];
    score: number;
  }) {
    if (!completedBy.includes(email)) {
      throw new Error('Can only enter quiz completions which you participate in.');
    }
    const uuid = uuidv4();
    const completion = await this.#persistence.createQuizCompletion(quizId, uuid, new Date(), completedBy, score);
    return { completion: this.#quizCompletionPersistenceToQuizCompletion(completion) };
  }

  async markQuizImageReady(imageKey: string) {
    const quizImage = await this.#persistence.getQuizImage(imageKey);
    if (!quizImage) {
      throw new Error(`Unable to find quizImage with key ${imageKey}`);
    }
    await this.#persistence.markQuizImageReady(imageKey);
  }

  /**
   * Get the max score for a quiz type.
   * @param quizType The type of quiz to get the max score for.
   * @returns The max score for the quiz type.
   */
  getMaxScoreForQuizType(quizType: QuizType) {
    switch (quizType) {
      case 'BRAINWAVES':
        return 50;
      case 'SHARK':
        return 20;
      default:
        throw new Error(`Unknown quizType ${quizType}`);
    }
  }

  /**
   * Get a paginated list of quiz percentages for a user.
   * @param filters Paging and filtering options.
   * @returns A list of quiz percentages (as a number between 0 and 1) for the user in stats and a cursor to load the next set of scores.
   */
  async quizScorePercentagesForUser({
    email,
    first = 100,
    afterId,
  }: {
    /**
     * The email of the user to get quiz percentages for.
     */
    email: string;
    /**
     * The number of quiz percentages to get.
     */
    first: number;
    /**
     * The cursor to start getting quiz percentages from.
     * If not provided, the first quiz percentage will be returned.
     * Will have been returned in the previous call to this function.
     */
    afterId?: string;
  }) {
    const { data, hasMoreRows } = await this.#persistence.getCompletionScoreWithQuizTypesForUser({
      email,
      limit: first,
      afterId,
    });
    return {
      stats: data.map((completion) => {
        const maxScore = this.getMaxScoreForQuizType(completion.quiz.type);
        return completion.score.toNumber() / maxScore;
      }),
      cursor: hasMoreRows ? data[data.length - 1]?.id : undefined,
    };
  }

  async #populateFileWithUploadLink(file: { fileName: string; type: QuizImageType; imageKey: string }) {
    const uploadLink = await this.#fileService.generateSignedUploadUrl(file.imageKey);
    return {
      ...file,
      uploadLink,
    };
  }

  #quizImagePersistenceToQuizImage(quizImage: QuizImagePersistenceModel): QuizImage {
    return {
      imageLink: this.#fileService.keyToUrl(quizImage.imageKey),
      state: quizImage.state,
      type: quizImage.type,
    };
  }

  #quizCompletionPersistenceToQuizCompletion(
    quizCompletion: Omit<QuizCompletionPersistenceModel, 'id' | 'quizId'> & {
      completedBy: (QuizCompletionUserPersistenceModel & {
        user: UserPersistenceModel | null;
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
          id: user.user.id,
          email: user.user.email,
          name: user.user.name ?? undefined,
        };
      }),
      score: score.toNumber(),
    };
  }

  #quizPersistenceWithMyCompletionsToQuiz(
    quiz: QuizPersistenceModel & {
      uploadedByUser: UserPersistenceModel;
      completions: (Omit<QuizCompletionPersistenceModel, 'id' | 'quizId'> & {
        completedBy: (QuizCompletionUserPersistenceModel & {
          user: UserPersistenceModel | null;
        })[];
      })[];
    },
  ): Quiz {
    // TODO modify linting tules to allow unused vars in destructuring
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { completions, uploadedByUser, uploadedByUserId, ...quizWithoutImageKey } = quiz;
    return {
      ...quizWithoutImageKey,
      myCompletions: completions.map((entry) => this.#quizCompletionPersistenceToQuizCompletion(entry)),
      uploadedBy: {
        id: uploadedByUser.id,
        email: uploadedByUser.email,
        name: uploadedByUser.name ?? undefined,
      },
    };
  }
}
