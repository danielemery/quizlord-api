import { v4 as uuidv4 } from 'uuid';

import { QuizService } from './quiz.service';
import { QuizPersistence } from './quiz.persistence';
import { S3FileService } from '../file/s3.service';
import { Decimal } from '@prisma/client/runtime/library';
import { UserService } from '../user/user.service';
import { MustProvideAtLeastOneFileError } from './quiz.errors';

jest.mock('uuid');

const mockedUUIDv4 = jest.mocked(uuidv4);
const mockPersistence = {
  createQuizWithImages: jest.fn(),
  getCompletionScoreWithQuizTypesForUser: jest.fn(),
  getQuizzesWithUserResults: jest.fn(),
  getQuizByIdWithResults: jest.fn(),
  getRecentQuizCompletions: jest.fn(),
};
const mockFileService = {
  createKey: jest.fn(),
  generateSignedUploadUrl: jest.fn(),
};
const mockUserService = {
  getUser: jest.fn(),
};

const sut = new QuizService(
  mockPersistence as unknown as QuizPersistence,
  mockFileService as unknown as S3FileService,
  mockUserService as unknown as UserService,
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
            uploadedByUserId: 'fake-user-id',
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
            uploadedByUserId: 'fake-user-id',
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
    describe('getRecentQuizCompletions', () => {
      it('must call getRecentQuizCompletions on persistence with correct arguments and transform the result', async () => {
        mockPersistence.getRecentQuizCompletions.mockResolvedValueOnce([
          {
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
            completionDate: new Date('2023-01-01'),
            score: 12,
            participants: [{ email: 'master@quizlord.net', name: 'Quiz Master' }],
            quizDate: new Date('2022-12-12'),
            quizType: 'SHARK',
          },
        ]);
      });
    });
  });
});
