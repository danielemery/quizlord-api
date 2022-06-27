import knex, { Knex } from "knex";
import { types } from "pg";
import { Quiz, QuizState, QuizType } from "./models";

interface QuizPersistence {
  id: string;
  type: QuizType;
  state: QuizState;
  date: Date;
  imageLink?: string;
}

export interface PersistenceResult<T> {
  data: T[];
  hasMoreRows: boolean;
}

const DATE_OID = 1082;
const parseDate = (value: string) => {
  return new Date(value);
};
types.setTypeParser(DATE_OID, parseDate);

class Persistence {
  #knexInstance: Knex;

  constructor() {
    console.log(
      `Connecting to database with ${process.env.DB_CONNECTION_STRING}`
    );
    this.#knexInstance = knex({
      client: "postgres",
      connection: process.env.DB_CONNECTION_STRING,
    });
    this.#knexInstance.raw("select 1+1 as result").catch((err) => {
      console.log(err);
      process.exit(1);
    });
  }

  async getQuizzes({
    afterId,
    limit,
  }: {
    afterId?: string;
    limit: number;
  }): Promise<PersistenceResult<Quiz>> {
    const queryBuilder = this.#knexInstance<QuizPersistence>("quiz")
      .select()
      .limit(limit)
      .orderBy("date", "desc");

    if (afterId) {
      const row = await this.#knexInstance<QuizPersistence>("quiz")
        .first()
        .where({ id: afterId });
      if (row) {
        queryBuilder.where("date", ">", row.date);
      }
    }
    const result = await queryBuilder;
    if (result.length > limit) {
      return {
        data: result.slice(0, limit),
        hasMoreRows: true,
      };
    } else {
      return {
        data: result,
        hasMoreRows: false,
      };
    }
  }

  async createQuiz(quiz: Quiz): Promise<Quiz> {
    await this.#knexInstance("quiz").insert<QuizPersistence>(quiz);
    return quiz;
  }
}

export const persistence = new Persistence();
