import knex, { Knex } from "knex";
import { types } from "pg";
import config from "../config";
import { QuizState, QuizType } from "../models";

export interface QuizPersistence {
  id: string;
  type: QuizType;
  state: QuizState;
  date: Date;
  image_key: string;
  created_at: Date;
  created_by: string;
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
    console.log(`Connecting to database`);
    this.#knexInstance = knex({
      client: "postgres",
      connection: {
        connectionString: config.DB_CONNECTION_STRING,
        ...(config.NODE_ENV !== 'development' && { ssl: { rejectUnauthorized: false }, }),
      },
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
  }): Promise<PersistenceResult<QuizPersistence>> {
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

  async getQuizById({ id }: { id: string }) {
    const quiz = await this.#knexInstance<QuizPersistence>("quiz")
      .first()
      .where("id", "=", id);
    if (!quiz) throw new Error(`No quiz found with id ${id}`);
    return quiz;
  }

  async getQuizByImageKey(
    imageKey: string
  ): Promise<QuizPersistence | undefined> {
    return this.#knexInstance<QuizPersistence>("quiz")
      .where("image_key", "=", imageKey)
      .first();
  }

  async markQuizReady(id: string) {
    await this.#knexInstance<QuizPersistence>("quiz")
      .update({ state: "READY" })
      .where("id", "=", id);
  }

  async createQuiz(quiz: QuizPersistence): Promise<QuizPersistence> {
    await this.#knexInstance("quiz").insert<QuizPersistence>(quiz);
    return quiz;
  }
}

export const persistence = new Persistence();
