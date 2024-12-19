import {
  Quiz as QuizPersistenceModel,
  QuizCompletion as QuizCompletionPersistenceModel,
  QuizCompletionUser as QuizCompletionUserPersistenceModel,
  QuizImage as QuizImagePersistenceModel,
  User as UserPersistenceModel,
  QuizImageType,
  QuizType,
} from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

import { S3FileService } from '../file/s3.service';
import { UserService } from '../user/user.service';
import { Quiz, QuizCompletion, QuizFilters, QuizImage } from './quiz.dto';
import { MustProvideAtLeastOneFileError } from './quiz.errors';
import { QuizPersistence } from './quiz.persistence';

const MAXIMUM_QUIZ_PAGE_SIZE = 100;

export class QuizService {
  #persistence: QuizPersistence;
  #fileService: S3FileService;
  #userService: UserService;

  constructor(persistence: QuizPersistence, fileService: S3FileService, userService: UserService) {
    this.#persistence = persistence;
    this.#fileService = fileService;
    this.#userService = userService;
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

  /**
   * Get a quiz along with all its completions and images.
   * @param id Id of the quiz to get details for.
   * @returns The quiz and its completions.
   */
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

  /**
   * Create a quiz.
   * The images are not provided directly here, but rather signed links
   * are returned that can be used to upload.
   *
   * The quiz will only be marked as ready once the images have been uploaded.
   *
   * @param userId The id of the user creating the quiz.
   * @param quizDetails The type, date and files for the quiz.
   * @returns The created quiz and links that should be used for uploading the files.
   */
  async createQuiz(
    userId: string,
    {
      type,
      date,
      files,
    }: {
      /** The type of quiz being created. */
      type: QuizType;
      /** The date the quiz was published. */
      date: Date;
      /** Images for the quiz. */
      files: {
        /** Name of the file. */
        fileName: string;
        /** What the image is of. */
        type: QuizImageType;
      }[];
    },
  ) {
    if (files.length === 0) {
      throw new MustProvideAtLeastOneFileError();
    }

    const user = await this.#userService.getUser(userId);

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
          email: user.email,
          name: user.name ?? null,
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
   * @param email The email of the user to get quiz percentages for.
   * @param first The number of quiz percentages to get, defaults to the maximum of 100.
   * @param afterId Optionally an id to use as a cursor to get quiz percentages after. This will have been provided in a previous call to this function.
   * @returns A list of quiz percentages (as a number between 0 and 1) for the user in stats and a cursor to load the next set of scores.
   */
  async quizScorePercentagesForUser(email: string, first = 100, afterId?: string) {
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

  /**
   * Get the most recent `first` quiz completions along with their participants.
   * @param first The number of completions to get. Defaults to 20.
   * @returns The most recent `first` quiz completions along with their participants.
   */
  async getRecentQuizCompletions(first = 20) {
    const recent = await this.#persistence.getRecentQuizCompletions({ limit: first });
    return recent.map((completion) => ({
      id: completion.id,
      quizId: completion.quiz.id,
      quizType: completion.quiz.type,
      quizDate: completion.quiz.date,
      completionDate: completion.completedAt,
      score: completion.score.toNumber(),
    }));
  }

  /**
   * Get the most recent `first` quiz uploads.
   * @param first The number of quizzes to get. Defaults to 20.
   * @returns The most recent `first` quiz uploads.
   */
  async getRecentQuizUploads(first = 20) {
    const recent = await this.#persistence.getRecentQuizUploads({ limit: first });
    return recent.map((quiz) => ({
      id: quiz.id,
      type: quiz.type,
      date: quiz.date,
      uploadedAt: quiz.uploadedAt,
      uploadedBy: {
        name: quiz.uploadedByUser.name,
        email: quiz.uploadedByUser.email,
      },
    }));
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
    const { completions, uploadedByUser, ...quizWithoutImageKey } = quiz;
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
  async markQuizIllegible(quizId: string, userEmail: string): Promise<void> {
    await this.#persistence.addQuizNote({
      quizId,
      noteType: 'ILLEGIBLE',
      submittedAt: new Date(),
      userEmail,
    });
  }
}
