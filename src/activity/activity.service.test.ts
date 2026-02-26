import { QuizService } from '../quiz/quiz.service.js';
import { UnhandledError } from '../util/common.errors.js';
import { ActivityService } from './activity.service.js';

const mockQuizService = {
  getRecentQuizUploads: vi.fn(),
  getRecentQuizCompletions: vi.fn(),
};

const sut = new ActivityService(mockQuizService as unknown as QuizService);
describe('activity', () => {
  describe('activity.service', () => {
    describe('getRecentActivity', () => {
      it('must work when there is only an upload', async () => {
        mockQuizService.getRecentQuizUploads.mockResolvedValueOnce([
          {
            id: 'fake-quiz-id',
            date: new Date('2020-06-07'),
            uploadedAt: new Date('2021-01-01'),
            uploadedBy: { name: 'Grant', email: 'grant@quizlord.net' },
            type: 'SHARK',
          },
        ]);
        mockQuizService.getRecentQuizCompletions.mockResolvedValueOnce([]);

        const actual = await sut.getRecentActivity(5);

        expect(actual).toEqual([
          {
            date: new Date('2021-01-01'),
            actionType: 'QUIZ_UPLOADED',
            resourceId: 'fake-quiz-id',
            text: 'Uploaded a SHARK from June 7, 2020',
          },
        ]);
      });
      it('must work when there is only a completion', async () => {
        mockQuizService.getRecentQuizUploads.mockResolvedValueOnce([]);
        mockQuizService.getRecentQuizCompletions.mockResolvedValueOnce([
          {
            id: 'fake-completion-id',
            quizDate: new Date('2020-03-23'),
            quizType: 'SHARK',
            score: 12,
            completedBy: [{ name: 'Master' }, { name: 'Beginner' }, { email: 'jack@quizlord.net' }],
            completionDate: new Date('2021-01-01'),
          },
        ]);

        const actual = await sut.getRecentActivity(5);

        expect(actual).toEqual([
          {
            date: new Date('2021-01-01'),
            actionType: 'QUIZ_COMPLETED',
            resourceId: 'fake-completion-id',
            text: 'Scored 12 on the SHARK from March 23, 2020',
          },
        ]);
      });
      it('must call quizService.getRecentQuizUploads and quizService.getRecentQuizCompletions and combine the results', async () => {
        mockQuizService.getRecentQuizUploads.mockResolvedValueOnce([
          {
            id: 'fake-quiz-id-one',
            date: new Date('2020-06-07'),
            uploadedAt: new Date('2021-01-21'),
            uploadedBy: { name: 'Bob', email: 'bob@quizlord.net' },
            type: 'BRAINWAVES',
          },
          {
            id: 'fake-quiz-id-two',
            date: new Date('2020-08-08'),
            uploadedAt: new Date('2021-01-11'),
            uploadedBy: { name: 'Tracey', email: 'tracey@quizlord.net' },
            type: 'SHARK',
          },
          {
            id: 'fake-quiz-id-three',
            date: new Date('2020-10-11'),
            uploadedAt: new Date('2021-01-02'),
            uploadedBy: { name: 'Grant', email: 'grant@quizlord.net' },
            type: 'SHARK',
          },
        ]);
        mockQuizService.getRecentQuizCompletions.mockResolvedValueOnce([
          {
            id: 'fake-completion-id-one',
            quizDate: new Date('2020-03-23'),
            quizType: 'BRAINWAVES',
            score: 19,
            completedBy: [{ name: 'Chloe' }],
            completionDate: new Date('2021-01-31'),
          },
          {
            id: 'fake-completion-id-two',
            quizDate: new Date('2020-03-23'),
            quizType: 'SHARK',
            score: 12,
            completedBy: [{ name: 'Daniel' }],
            completionDate: new Date('2021-01-05'),
          },
          {
            id: 'fake-completion-id-three',
            quizDate: new Date('2020-03-23'),
            quizType: 'SHARK',
            score: 9,
            completedBy: [{ name: 'Master' }, { name: 'Beginner' }, { email: 'jack@quizlord.net' }],
            completionDate: new Date('2021-01-01'),
          },
        ]);

        const actual = await sut.getRecentActivity(5);

        expect(actual).toEqual([
          {
            date: new Date('2021-01-31'),
            actionType: 'QUIZ_COMPLETED',
            resourceId: 'fake-completion-id-one',
            text: 'Scored 19 on the BRAINWAVES from March 23, 2020',
          },
          {
            date: new Date('2021-01-21'),
            actionType: 'QUIZ_UPLOADED',
            resourceId: 'fake-quiz-id-one',
            text: 'Uploaded a BRAINWAVES from June 7, 2020',
          },
          {
            date: new Date('2021-01-11'),
            actionType: 'QUIZ_UPLOADED',
            resourceId: 'fake-quiz-id-two',
            text: 'Uploaded a SHARK from August 8, 2020',
          },
          {
            date: new Date('2021-01-05'),
            actionType: 'QUIZ_COMPLETED',
            resourceId: 'fake-completion-id-two',
            text: 'Scored 12 on the SHARK from March 23, 2020',
          },
          {
            date: new Date('2021-01-02'),
            actionType: 'QUIZ_UPLOADED',
            resourceId: 'fake-quiz-id-three',
            text: 'Uploaded a SHARK from October 11, 2020',
          },
        ]);
      });
    });
    describe('userListToString', () => {
      it('must throw an error if the user list is empty', () => {
        expect(() => sut.userListToString([])).toThrow(UnhandledError);
      });
      it('must just return the name or email of a single user', () => {
        expect(sut.userListToString([{ name: 'John', email: 'john@quizlord.net' }])).toEqual('John');
        expect(sut.userListToString([{ email: 'john@quizlord.net' }])).toEqual('john@quizlord.net');
      });
      it('must return names separated by & for two users', () => {
        expect(
          sut.userListToString([
            { name: 'Jack', email: 'jack@quizlord.net' },
            { name: 'Jill', email: 'jill@quizlord.net' },
          ]),
        ).toEqual('Jack & Jill');
      });
      it('must return names separated by commas and & for three or more users', () => {
        expect(
          sut.userListToString([
            { name: 'Jack', email: 'jack@quizlord.net' },
            { name: 'Jill', email: 'jill@quizlord.net' },
            { name: 'Bob', email: 'bob@quizlord.net' },
            { email: 'nabbs@quizlord.net' },
          ]),
        ).toEqual('Jack, Jill, Bob & nabbs@quizlord.net');
      });
    });
  });
});
