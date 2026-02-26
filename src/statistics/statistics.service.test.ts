import { QuizService } from '../quiz/quiz.service';
import { UserService } from '../user/user.service';
import { Cache } from '../util/cache';
import { IndividualUserStatisticsSortOption } from './statistics.dto';
import { StatisticsService } from './statistics.service';

const mockUserService = {
  getUsers: vi.fn(),
};
const mockQuizService = {
  quizScorePercentagesForUser: vi.fn(),
};
const mockCache = {
  getItem: vi.fn(),
  setItem: vi.fn(),
};

describe('statistics', () => {
  describe('statistics.service', () => {
    const sut = new StatisticsService(
      mockUserService as unknown as UserService,
      mockQuizService as unknown as QuizService,
      mockCache as unknown as Cache,
    );
    beforeEach(() => {
      vi.restoreAllMocks();
    });
    describe('getIndividualUserStatistics', () => {
      const fakeResultOne = {
        email: 'quizmaster@quizlord.net',
        totalQuizCompletions: 101,
        averageScorePercentage: 0.99,
      };
      const fakeResultTwo = {
        email: 'quiznoob@quizlord.net',
        totalQuizCompletions: 1,
        averageScorePercentage: 0.01,
      };
      it('must load from the cache if data present there and sort the contents by number of quizzes completed if no sort argument is passed', async () => {
        mockCache.getItem.mockResolvedValueOnce([fakeResultOne, fakeResultTwo]);

        const mockSortIndividualUserStatistics = vi
          .spyOn(sut, 'sortIndividualUserStatistics')
          .mockReturnValueOnce([fakeResultTwo, fakeResultOne]);

        const actual = await sut.getIndividualUserStatistics();

        expect(mockCache.getItem).toHaveBeenCalledTimes(1);
        expect(mockCache.getItem).toHaveBeenCalledWith('individual-user-statistics');

        expect(mockSortIndividualUserStatistics).toHaveBeenCalledTimes(1);
        expect(mockSortIndividualUserStatistics).toHaveBeenCalledWith(
          [fakeResultOne, fakeResultTwo],
          'QUIZZES_COMPLETED_DESC',
        );

        expect(actual).toEqual([fakeResultTwo, fakeResultOne]);
      });
      it('must sort by sortedBy argument if present', async () => {
        mockCache.getItem.mockResolvedValueOnce([fakeResultOne, fakeResultTwo]);

        const mockSortIndividualUserStatistics = vi
          .spyOn(sut, 'sortIndividualUserStatistics')
          .mockReturnValueOnce([fakeResultTwo, fakeResultOne]);

        await sut.getIndividualUserStatistics('AVERAGE_SCORE_DESC');

        expect(mockSortIndividualUserStatistics).toHaveBeenCalledTimes(1);
        expect(mockSortIndividualUserStatistics).toHaveBeenCalledWith(
          [fakeResultOne, fakeResultTwo],
          'AVERAGE_SCORE_DESC',
        );
      });
      it('must load statistics for all users across multiple pages if there is a cache miss, and sort the results', async () => {
        const expected = [
          {
            email: 'userOne@quizlord.net',
            name: 'One',
            totalQuizCompletions: 7,
            averageScorePercentage: 0.2,
          },
          {
            email: 'userTwo@quizlord.net',
            name: undefined,
            totalQuizCompletions: 7,
            averageScorePercentage: 0.2,
          },
          {
            email: 'userThree@quizlord.net',
            name: 'Three',
            totalQuizCompletions: 7,
            averageScorePercentage: 0.2,
          },
        ];

        mockUserService.getUsers
          .mockResolvedValueOnce({
            data: [
              {
                id: '1',
                email: 'userOne@quizlord.net',
                name: 'One',
              },
              {
                id: '75',
                email: 'userTwo@quizlord.net',
              },
            ],
            hasMoreRows: true,
          })
          .mockResolvedValueOnce({
            data: [
              {
                id: '45',
                email: 'userThree@quizlord.net',
                name: 'Three',
              },
            ],
            hasMoreRows: false,
          });

        const mockGetStatisticsForUser = vi
          .spyOn(sut, 'getStatisticsForUser')
          .mockResolvedValue({ totalQuizCompletions: 7, averageScorePercentage: 0.2 });

        const mockSortIndividualUserStatistics = vi
          .spyOn(sut, 'sortIndividualUserStatistics')
          .mockReturnValueOnce(expected);

        const actual = await sut.getIndividualUserStatistics();

        expect(mockUserService.getUsers).toHaveBeenCalledTimes(2);
        expect(mockUserService.getUsers).toHaveBeenNthCalledWith(1, 100, 'EMAIL_ASC', undefined);
        expect(mockUserService.getUsers).toHaveBeenNthCalledWith(2, 100, 'EMAIL_ASC', '75');

        expect(mockGetStatisticsForUser).toHaveBeenCalledTimes(3);
        expect(mockGetStatisticsForUser).toHaveBeenNthCalledWith(1, 'userOne@quizlord.net');
        expect(mockGetStatisticsForUser).toHaveBeenNthCalledWith(2, 'userTwo@quizlord.net');
        expect(mockGetStatisticsForUser).toHaveBeenNthCalledWith(3, 'userThree@quizlord.net');

        expect(mockSortIndividualUserStatistics).toHaveBeenCalledTimes(1);
        expect(mockSortIndividualUserStatistics).toHaveBeenCalledWith(expected, 'QUIZZES_COMPLETED_DESC');

        expect(mockCache.setItem).toHaveBeenCalledTimes(1);
        expect(mockCache.setItem).toHaveBeenCalledWith('individual-user-statistics', expected, 24 * 60 * 60 * 1000);

        expect(actual).toEqual(expected);
      });
    });
    describe('sortIndividualUserStatistics', () => {
      const quizMaster = {
        email: 'quizmaster@quizlord.net',
        totalQuizCompletions: 101,
        averageScorePercentage: 0.99,
      };
      const quizNoob = {
        email: 'quiznoob@quizlord.net',
        totalQuizCompletions: 1,
        averageScorePercentage: 0.01,
      };
      const quizMiddler = {
        email: 'middlingquizzer@quizlord.net',
        totalQuizCompletions: 150,
        averageScorePercentage: 0.5,
      };
      it('must sort by number of quizzes completed if the QUIZZES_COMPLETED_DESC sort option is provided', () => {
        const actual = sut.sortIndividualUserStatistics([quizMaster, quizNoob, quizMiddler], 'QUIZZES_COMPLETED_DESC');

        expect(actual).toEqual([quizMiddler, quizMaster, quizNoob]);
      });
      it('must sort by average score if the AVERAGE_SCORE_DESC sort option is provided', () => {
        const actual = sut.sortIndividualUserStatistics([quizMaster, quizNoob, quizMiddler], 'AVERAGE_SCORE_DESC');

        expect(actual).toEqual([quizMaster, quizMiddler, quizNoob]);
      });
      it('must return the statistics unsorted and log a warning if an unknown sort option is provided', () => {
        const actual = sut.sortIndividualUserStatistics(
          [quizMaster, quizNoob, quizMiddler],
          'UNKNOWN_SORT_OPTION' as unknown as IndividualUserStatisticsSortOption,
        );

        expect(actual).toEqual([quizMaster, quizNoob, quizMiddler]);
      });
    });
    describe('getStatisticsForUser', () => {
      it('must load quiz completions page by page for the user and return the number of completions and average score', async () => {
        mockQuizService.quizScorePercentagesForUser
          .mockResolvedValueOnce({
            stats: [0.25, 0.75],
            cursor: 'fake-cursor',
          })
          .mockResolvedValueOnce({
            stats: [0.5, 0.5],
            cursor: undefined,
          });

        const actual = await sut.getStatisticsForUser('master@quizlord.net');

        expect(mockQuizService.quizScorePercentagesForUser).toHaveBeenCalledTimes(2);
        expect(mockQuizService.quizScorePercentagesForUser).toHaveBeenNthCalledWith(
          1,
          'master@quizlord.net',
          100,
          undefined,
        );
        expect(mockQuizService.quizScorePercentagesForUser).toHaveBeenNthCalledWith(
          2,
          'master@quizlord.net',
          100,
          'fake-cursor',
        );

        expect(actual).toEqual({ totalQuizCompletions: 4, averageScorePercentage: 0.5 });
      });
      it('must return 0 completions and 0 average score if the user has no completions', async () => {
        mockQuizService.quizScorePercentagesForUser.mockResolvedValueOnce({
          stats: [],
          cursor: undefined,
        });

        const actual = await sut.getStatisticsForUser('master@quizlord.net');

        expect(actual).toEqual({ totalQuizCompletions: 0, averageScorePercentage: 0 });
      });
    });
  });
});
