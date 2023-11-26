import { QuizService } from '../quiz/quiz.service';
import { UnhandledError } from '../util/common.errors';
import { ActivityService } from './activity.service';

const mockQuizService = {
  getRecentQuizUploads: jest.fn(),
  getRecentQuizCompletions: jest.fn(),
};

const sut = new ActivityService(mockQuizService as unknown as QuizService);
describe('activity', () => {
  describe('activity.service', () => {
    describe('getRecentActivity', () => {
      it('must work when there is only an upload', async () => {
        mockQuizService.getRecentQuizUploads.mockResolvedValueOnce([
          {
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
            text: 'New SHARK quiz from June 7, 2020 uploaded by Grant',
          },
        ]);
      });
      it('must work when there is only a completion', async () => {
        mockQuizService.getRecentQuizUploads.mockResolvedValueOnce([]);
        mockQuizService.getRecentQuizCompletions.mockResolvedValueOnce([
          {
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
            text: 'Master, Beginner & jack@quizlord.net scored 12 on the SHARK quiz from March 23, 2020',
          },
        ]);
      });
      it('must call quizService.getRecentQuizUploads and quizService.getRecentQuizCompletions and combine the results', async () => {
        mockQuizService.getRecentQuizUploads.mockResolvedValueOnce([
          {
            date: new Date('2020-06-07'),
            uploadedAt: new Date('2021-01-21'),
            uploadedBy: { name: 'Bob', email: 'bob@quizlord.net' },
            type: 'BRAINWAVES',
          },
          {
            date: new Date('2020-08-08'),
            uploadedAt: new Date('2021-01-11'),
            uploadedBy: { name: 'Tracey', email: 'tracey@quizlord.net' },
            type: 'SHARK',
          },
          {
            date: new Date('2020-10-11'),
            uploadedAt: new Date('2021-01-02'),
            uploadedBy: { name: 'Grant', email: 'grant@quizlord.net' },
            type: 'SHARK',
          },
        ]);
        mockQuizService.getRecentQuizCompletions.mockResolvedValueOnce([
          {
            quizDate: new Date('2020-03-23'),
            quizType: 'BRAINWAVES',
            score: 19,
            completedBy: [{ name: 'Chloe' }],
            completionDate: new Date('2021-01-31'),
          },
          {
            quizDate: new Date('2020-03-23'),
            quizType: 'SHARK',
            score: 12,
            completedBy: [{ name: 'Daniel' }],
            completionDate: new Date('2021-01-05'),
          },
          {
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
            text: 'Chloe scored 19 on the BRAINWAVES quiz from March 23, 2020',
          },
          {
            date: new Date('2021-01-21'),
            text: 'New BRAINWAVES quiz from June 7, 2020 uploaded by Bob',
          },
          {
            date: new Date('2021-01-11'),
            text: 'New SHARK quiz from August 8, 2020 uploaded by Tracey',
          },
          {
            date: new Date('2021-01-05'),
            text: 'Daniel scored 12 on the SHARK quiz from March 23, 2020',
          },
          {
            date: new Date('2021-01-02'),
            text: 'New SHARK quiz from October 11, 2020 uploaded by Grant',
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
