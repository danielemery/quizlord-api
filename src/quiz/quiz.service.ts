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

export class QuizService {
  #persistence: QuizPersistence;
  #fileService: S3FileService;

  constructor(persistence: QuizPersistence) {
    this.#persistence = persistence;
    this.#fileService = new S3FileService();
  }

  async getQuizzesWithMyResults({
    email,
    first = 100,
    afterId,
    filters = {},
  }: {
    email: string;
    first: number;
    afterId?: string;
    filters: QuizFilters;
  }) {
    const { data, hasMoreRows } = await this.#persistence.getQuizzesWithMyResults({
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
    quizCompletion: QuizCompletionPersistenceModel & {
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
      completions: (QuizCompletionPersistenceModel & {
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
}
