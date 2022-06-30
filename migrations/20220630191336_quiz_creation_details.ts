import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("quiz", (table) => {
    table.dateTime("created_at");
    table.string("created_by");
  });

  await knex("quiz").update({
    created_at: new Date(),
    created_by: "danielremery@gmail.com",
  });

  await knex.schema.alterTable("quiz", (table) => {
    table.dateTime("created_at").notNullable().alter();
    table.string("created_by").notNullable().alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("quiz", (table) => {
    table.dropColumn("created_at");
    table.dropColumn("created_by");
  });
}
