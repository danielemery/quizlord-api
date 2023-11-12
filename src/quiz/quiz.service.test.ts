import { QuizService } from './quiz.service';
import { QuizPersistence } from './quiz.persistence';
import { S3FileService } from '../file/s3.service';
import { Decimal } from '@prisma/client/runtime/library';

const mockPersistence = {
  getQuizzesWithUserResults: jest.fn(),
  getCompletionScoreWithQuizTypesForUser: jest.fn(),
};
const mockFileService = {};

const sut = new QuizService(mockPersistence as unknown as QuizPersistence, mockFileService as S3FileService);

describe('quiz', () => {
  describe('quiz.service', () => {
    beforeEach(() => {
      jest.restoreAllMocks();
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
  });
});
