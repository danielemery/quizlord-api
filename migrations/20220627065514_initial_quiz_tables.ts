import { Knex } from "knex";
import { QuizState, QuizType } from "../src/models";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("quiz", (table) => {
    table.uuid("id").primary({ constraintName: "quiz_pk" }).notNullable();
    const types: QuizType[] = ["BRAINWAVES", "SHARK"];
    table.enu("type", types).notNullable();
    const states: QuizState[] = ["PENDING_UPLOAD", "READY"];
    table.enu("state", states).notNullable();
    table.date("date").notNullable();
    table.string("imageKey");
    table.unique(["date", "type"], { indexName: "quiz_uq_date_type" });
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable("quizlord.quiz");
}
