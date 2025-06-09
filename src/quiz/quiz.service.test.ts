import { Decimal } from '@prisma/client/runtime/library';
import { v4 as uuidv4, Version4Options } from 'uuid';

import { GeminiService } from '../ai/gemini.service';
import { S3FileService } from '../file/s3.service';
import { SQSQueuePublisherService } from '../queue/sqs-publisher.service';
import { UserService } from '../user/user.service';
import { MustProvideAtLeastOneFileError } from './quiz.errors';
import { QuizPersistence } from './quiz.persistence';
import { QuizService } from './quiz.service';

jest.mock('uuid');

// We need to cast here to the specific overload on the uuidv4 we are using, otherwise typescript selects the wrong overload.
const mockedUUIDv4 = jest.mocked(uuidv4 as (options?: Version4Options, buf?: undefined, offset?: number) => string);
const mockPersistence = {
  createQuizWithImages: jest.fn(),
  getCompletionScoreWithQuizTypesForUser: jest.fn(),
  getQuizzesWithUserResults: jest.fn(),
  getQuizByIdWithResults: jest.fn(),
  getRecentQuizCompletions: jest.fn(),
  getRecentQuizUploads: jest.fn(),
};
const mockFileService = {
  createKey: jest.fn(),
  generateSignedUploadUrl: jest.fn(),
};
const mockUserService = {
  getUser: jest.fn(),
};
const mockGeminiService = {};
const mockSQSQueuePublisherService = {};

const sut = new QuizService(
  mockPersistence as unknown as QuizPersistence,
  mockFileService as unknown as S3FileService,
  mockUserService as unknown as UserService,
  mockGeminiService as unknown as GeminiService,
  mockSQSQueuePublisherService as unknown as SQSQueuePublisherService,
);

describe('quiz', () => {
  describe('quiz.service', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      jest.restoreAllMocks();
    });
    afterEach(() => {
      jest.useRealTimers();
    });
    describe('getQuizzesWithUserResults', () => {
      it('must call getQuizzesWithUserResults on persistence with correct arguments and transform the result', async () => {
        const persistenceResult = [
          {
            id: 'fake-id-one',
            type: 'SHARK',
            date: new Date('2023-01-01'),
            uploadedAt: new Date('2023-01-02'),
            completions: [],
            uploadedByUser: {
              id: 'fake-user-id',
              email: 'joe@blogs.com',
              name: 'Joe Blogs',
            },
          },
          {
            id: 'fake-id-two',
            type: 'BRAINWAVES',
            date: new Date('2023-02-01'),
            uploadedAt: new Date('2023-03-02'),
            completions: [
              {
                completedAt: new Date('2023-03-10'),
                completedBy: [
                  {
                    user: {
                      id: 'fake-completion-user-id',
                      email: 'completer@fake.com',
                      name: 'Completer',
                    },
                  },
                ],
                score: new Decimal(10),
              },
            ],
            uploadedByUser: {
              id: 'fake-user-id',
              email: 'joe@blogs.com',
              name: 'Joe Blogs',
            },
          },
        ];
        mockPersistence.getQuizzesWithUserResults.mockImplementationOnce(() =>
          Promise.resolve({ data: persistenceResult, hasMoreRows: false }),
        );

        const actual = await sut.getQuizzesWithUsersResults('fake@fake.com', 10);

        expect(mockPersistence.getQuizzesWithUserResults).toHaveBeenCalledTimes(1);
        expect(mockPersistence.getQuizzesWithUserResults).toHaveBeenCalledWith({
          userEmail: 'fake@fake.com',
          limit: 10,
        });

        expect(actual).toEqual({
          data: [
            {
              id: 'fake-id-one',
              type: 'SHARK',
              date: new Date('2023-01-01'),
              uploadedAt: new Date('2023-01-02'),
              uploadedBy: {
                email: 'joe@blogs.com',
                id: 'fake-user-id',
                name: 'Joe Blogs',
              },
              myCompletions: [],
            },
            {
              id: 'fake-id-two',
              type: 'BRAINWAVES',
              date: new Date('2023-02-01'),
              uploadedAt: new Date('2023-03-02'),
              uploadedBy: {
                email: 'joe@blogs.com',
                id: 'fake-user-id',
                name: 'Joe Blogs',
              },
              myCompletions: [
                {
                  completedAt: new Date('2023-03-10'),
                  completedBy: [
                    {
                      id: 'fake-completion-user-id',
                      email: 'completer@fake.com',
                      name: 'Completer',
                    },
                  ],
                  score: 10,
                },
              ],
            },
          ],
          hasMoreRows: false,
        });
      });
    });
    describe('quizScorePercentagesForUser', () => {
      it('must call getCompletionScoreWithQuizTypesForUser on persistence with correct arguments and calculate percentages for the results', async () => {
        mockPersistence.getCompletionScoreWithQuizTypesForUser.mockResolvedValueOnce({
          data: [
            {
              id: '1',
              quiz: {
                type: 'SHARK',
              },
              score: new Decimal(10),
            },
            {
              id: '2',
              quiz: {
                type: 'BRAINWAVES',
              },
              score: new Decimal(12.5),
            },
          ],
          hasMoreRows: false,
        });

        const actual = await sut.quizScorePercentagesForUser('master@quizlord.net', 2, 'test-cursor');

        expect(mockPersistence.getCompletionScoreWithQuizTypesForUser).toHaveBeenCalledTimes(1);
        expect(mockPersistence.getCompletionScoreWithQuizTypesForUser).toHaveBeenCalledWith({
          email: 'master@quizlord.net',
          limit: 2,
          afterId: 'test-cursor',
        });

        expect(actual).toEqual({
          stats: [0.5, 0.25],
          cursor: undefined,
        });
      });
      it('must provide the correct cursor if more data is available', async () => {
        mockPersistence.getCompletionScoreWithQuizTypesForUser.mockResolvedValueOnce({
          data: [
            {
              id: '1',
              quiz: {
                type: 'SHARK',
              },
              score: new Decimal(10),
            },
            {
              id: '2',
              quiz: {
                type: 'BRAINWAVES',
              },
              score: new Decimal(12.5),
            },
          ],
          hasMoreRows: true,
        });

        const actual = await sut.quizScorePercentagesForUser('master@quizlord.net');

        expect(actual).toEqual({
          stats: [0.5, 0.25],
          cursor: '2',
        });
      });
    });
    describe('getQuizDetails', () => {
      it('must call getQuizByIdWithResults on persistence with correct arguments and transform the result', async () => {
        mockPersistence.getQuizByIdWithResults.mockResolvedValueOnce({
          id: 'fake-quiz-id',
          type: 'SHARK',
          date: new Date('2023-01-01'),
          uploadedAt: new Date('2023-01-02'),
          completions: [],
          images: [],
          uploadedByUser: {
            id: 'fake-user-id',
            email: 'master@quizlord.net',
            name: 'Master',
          },
          notes: [
            {
              noteType: 'INACCURATE_OCR',
            },
          ],
        });

        const actual = await sut.getQuizDetails('fake-quiz-id');

        expect(actual).toEqual({
          id: 'fake-quiz-id',
          type: 'SHARK',
          date: new Date('2023-01-01'),
          uploadedAt: new Date('2023-01-02'),
          completions: [],
          images: [],
          uploadedBy: {
            id: 'fake-user-id',
            email: 'master@quizlord.net',
            name: 'Master',
          },
          reportedInaccurateOCR: true,
        });
      });
    });
    describe('createQuiz', () => {
      it('must throw if no files are provided', async () => {
        await expect(() =>
          sut.createQuiz('fake-user', { type: 'SHARK', date: new Date('2022-01-01'), files: [] }),
        ).rejects.toThrow(MustProvideAtLeastOneFileError);
      });
      it('must create quiz with upload link for each image', async () => {
        const fakeNow = new Date('2023-02-12');
        jest.useFakeTimers();
        jest.setSystemTime(fakeNow);

        mockedUUIDv4.mockReturnValueOnce('fake-quiz-id');
        mockUserService.getUser.mockResolvedValueOnce({
          email: 'quizmaster@quizlord.net',
        });
        mockFileService.createKey.mockReturnValueOnce('key-one').mockReturnValueOnce('key-two');
        mockFileService.generateSignedUploadUrl
          .mockResolvedValueOnce('https://upload-one.net')
          .mockResolvedValueOnce('https://upload-two.net');

        const actual = await sut.createQuiz('fake-user-id', {
          date: new Date('2022-01-01'),
          type: 'SHARK',
          files: [
            {
              fileName: 'questions.jpg',
              type: 'QUESTION',
            },
            {
              fileName: 'answers.jpg',
              type: 'ANSWER',
            },
          ],
        });

        expect(mockedUUIDv4).toHaveBeenCalledTimes(1);
        expect(mockFileService.createKey).toHaveBeenCalledTimes(2);
        expect(mockFileService.createKey).toHaveBeenNthCalledWith(1, 'fake-quiz-id', 'questions.jpg');
        expect(mockFileService.createKey).toHaveBeenNthCalledWith(2, 'fake-quiz-id', 'answers.jpg');
        expect(mockFileService.generateSignedUploadUrl).toHaveBeenCalledTimes(2);
        expect(mockFileService.generateSignedUploadUrl).toHaveBeenNthCalledWith(1, 'key-one');
        expect(mockFileService.generateSignedUploadUrl).toHaveBeenNthCalledWith(2, 'key-two');
        expect(mockPersistence.createQuizWithImages).toHaveBeenCalledTimes(1);
        expect(mockPersistence.createQuizWithImages).toHaveBeenCalledWith(
          {
            date: new Date('2022-01-01'),
            id: 'fake-quiz-id',
            type: 'SHARK',
            uploadedAt: new Date(fakeNow),
            uploadedByUserId: 'fake-user-id',
            aiProcessingCertaintyPercent: null,
            aiProcessingState: 'NOT_QUEUED',
            aiProcessingModel: null,
          },
          [
            { imageKey: 'key-one', state: 'PENDING_UPLOAD', type: 'QUESTION' },
            { imageKey: 'key-two', state: 'PENDING_UPLOAD', type: 'ANSWER' },
          ],
        );

        expect(actual).toEqual({
          quiz: {
            myCompletions: [],
            uploadedBy: {
              email: 'quizmaster@quizlord.net',
              id: 'fake-user-id',
              name: undefined,
            },
          },
          uploadLinks: [
            {
              fileName: 'questions.jpg',
              link: 'https://upload-one.net',
            },
            {
              fileName: 'answers.jpg',
              link: 'https://upload-two.net',
            },
          ],
        });
      });
    });
    describe('computeScore', () => {
      it('must throw if neither a score not individual question results are provided', async () => {
        expect(() => sut.computeScore(undefined, undefined)).toThrow(
          'Must provide either a score or individual question results',
        );
      });
      it('must add up the score if individual question results are provided', async () => {
        const actual = sut.computeScore(undefined, [
          {
            questionNum: 1,
            score: 'CORRECT',
          },
          {
            questionNum: 2,
            score: 'HALF_CORRECT',
          },
          {
            questionNum: 3,
            score: 'CORRECT',
          },
          {
            questionNum: 4,
            score: 'CORRECT',
          },
          {
            questionNum: 5,
            score: 'INCORRECT',
          },
        ]);

        expect(actual).toEqual(3.5);
      });
      it('must return the score if a score is provided', async () => {
        const actual = sut.computeScore(10, undefined);

        expect(actual).toEqual(10);
      });
      it("must throw if a score and individual question results are provided and they don't match", async () => {
        expect(() =>
          sut.computeScore(10, [
            {
              questionNum: 1,
              score: 'CORRECT',
            },
            {
              questionNum: 2,
              score: 'HALF_CORRECT',
            },
          ]),
        ).toThrow('Provided score does not match individual question results');
      });
    });
    describe('validateQuestionResults', () => {
      it('must throw if two question results with the same question number are provided', () => {
        expect(() =>
          sut.validateQuestionResults([
            {
              questionNum: 1,
              score: 'CORRECT',
            },
            {
              questionNum: 1,
              score: 'INCORRECT',
            },
          ]),
        ).toThrow('Duplicate question numbers found in question results');
      });
      it('must throw if a question result is skipped', () => {
        expect(() =>
          sut.validateQuestionResults([
            {
              questionNum: 1,
              score: 'CORRECT',
            },
            {
              questionNum: 3,
              score: 'INCORRECT',
            },
          ]),
        ).toThrow('Question numbers must be less than or equal to the number of questions (2)');
      });
      it('must not throw if all question results are valid', () => {
        expect(() =>
          sut.validateQuestionResults([
            {
              questionNum: 1,
              score: 'CORRECT',
            },
            {
              questionNum: 2,
              score: 'INCORRECT',
            },
          ]),
        ).not.toThrow();
      });
    });
    describe('getRecentQuizCompletions', () => {
      it('must call getRecentQuizCompletions on persistence with correct arguments and transform the result', async () => {
        mockPersistence.getRecentQuizCompletions.mockResolvedValueOnce([
          {
            id: 'fake-completion-id',
            completedAt: new Date('2023-01-01'),
            score: new Decimal(12),
            completedBy: [
              {
                user: {
                  email: 'master@quizlord.net',
                  name: 'Quiz Master',
                },
              },
            ],
            quiz: {
              id: 'fake-quiz-id',
              type: 'SHARK',
              date: new Date('2022-12-12'),
            },
          },
        ]);

        const actual = await sut.getRecentQuizCompletions();

        expect(mockPersistence.getRecentQuizCompletions).toHaveBeenCalledTimes(1);
        expect(mockPersistence.getRecentQuizCompletions).toHaveBeenCalledWith({ limit: 20 });

        expect(actual).toEqual([
          {
            id: 'fake-completion-id',
            completionDate: new Date('2023-01-01'),
            score: 12,
            quizId: 'fake-quiz-id',
            quizDate: new Date('2022-12-12'),
            quizType: 'SHARK',
          },
        ]);
      });
    });
    describe('getRecentQuizUploads', () => {
      it('must call getRecentQuizUploads on persistence with correct arguments and transform the result', async () => {
        mockPersistence.getRecentQuizUploads.mockResolvedValueOnce([
          {
            id: 'fake-quiz-id',
            type: 'SHARK',
            date: new Date('2022-12-12'),
            uploadedAt: new Date('2023-01-01'),
            uploadedByUser: {
              email: 'master@quizlord.net',
              name: 'Quiz Master',
            },
          },
        ]);

        const actual = await sut.getRecentQuizUploads();

        expect(mockPersistence.getRecentQuizUploads).toHaveBeenCalledTimes(1);
        expect(mockPersistence.getRecentQuizUploads).toHaveBeenCalledWith({ limit: 20 });

        expect(actual).toEqual([
          {
            id: 'fake-quiz-id',
            type: 'SHARK',
            date: new Date('2022-12-12'),
            uploadedAt: new Date('2023-01-01'),
            uploadedBy: {
              email: 'master@quizlord.net',
              name: 'Quiz Master',
            },
          },
        ]);
      });
    });
  });
});
