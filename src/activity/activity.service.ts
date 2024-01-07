import { QuizService } from '../quiz/quiz.service';
import { UnhandledError } from '../util/common.errors';

// TODO later generate this from the gql schema.
export interface RecentActivityItem {
  date: Date;
  actionType: 'QUIZ_COMPLETED' | 'QUIZ_UPLOADED';
  resourceId: string;
  text: string;
  action?: {
    name: string;
    link: string;
  };
}

const quizDateFormatter = new Intl.DateTimeFormat('en', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

export class ActivityService {
  #quizService: QuizService;
  constructor(quizService: QuizService) {
    this.#quizService = quizService;
  }

  /**
   * Get the most recent `first` activity items.
   *
   * These currently include quiz uploads and completions.
   *
   * @param first The number of activity items to return.
   * @returns The most recent `first` activity items.
   */
  async getRecentActivity(first = 20) {
    const [recentUploads, recentCompletions] = await Promise.all([
      this.#quizService.getRecentQuizUploads(first),
      this.#quizService.getRecentQuizCompletions(first),
    ]);

    const results: RecentActivityItem[] = [];

    let uploadIndex = 0;
    let completionIndex = 0;
    const end = Math.min(first, recentUploads.length + recentCompletions.length);
    while (uploadIndex + completionIndex < end) {
      const upload = recentUploads[uploadIndex];
      const completion = recentCompletions[completionIndex];

      if (!completion || (upload && upload.uploadedAt > completion.completionDate)) {
        results.push({
          date: upload.uploadedAt,
          actionType: 'QUIZ_UPLOADED',
          resourceId: upload.id,
          text: `New ${upload.type} quiz from ${quizDateFormatter.format(upload.date)} uploaded`,
        });
        uploadIndex++;
      } else {
        results.push({
          date: completion.completionDate,
          actionType: 'QUIZ_COMPLETED',
          resourceId: completion.id,
          text: `${completion.quizType} quiz from ${quizDateFormatter.format(
            completion.quizDate,
          )} completed with score ${completion.score}`,
        });
        completionIndex++;
      }
    }

    return results;
  }
  /**
   * Get a formatted string list of users.
   * @param users List of userlike objects (contain and email and optionally a name)
   * @returns A formatted string list of users.
   *
   * // TODO move this to utils or to user service.
   */
  userListToString(
    users: {
      name?: string | null;
      email: string;
    }[],
  ) {
    if (users.length === 0) {
      throw new UnhandledError('Cannot format an empty user list');
    }
    const names = users.map((user) => user.name ?? user.email);
    if (names.length === 1) {
      return names[0];
    }
    return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
  }
}
