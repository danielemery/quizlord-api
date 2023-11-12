import { QuizService } from './quiz.service';
import { QuizPersistence } from './quiz.persistence';
import { S3FileService } from '../file/s3.service';
import { Decimal } from '@prisma/client/runtime/library';

jest.mock('./quiz.persistence');

const mockPersistence = {
  getQuizzesWithMyResults: jest.fn(),
};
const mockFileService = {};

const sut = new QuizService(mockPersistence as unknown as QuizPersistence, mockFileService as S3FileService);

describe('QuizService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });
  describe('getQuizzesWithMyResults', () => {
    it('must call getQuizzesWithMyResults on persistence with correct arguments and transform the result', async () => {
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
      mockPersistence.getQuizzesWithMyResults.mockImplementationOnce(() =>
        Promise.resolve({ data: persistenceResult, hasMoreRows: false }),
      );

      const actual = await sut.getQuizzesWithMyResults({
        email: 'fake@fake.com',
        first: 10,
        filters: {},
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
});
