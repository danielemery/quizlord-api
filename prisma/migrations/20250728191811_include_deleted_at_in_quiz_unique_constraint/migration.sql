/*
  Warnings:

  - A unique constraint covering the columns `[date,type,deleted_at]` on the table `quiz` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "quiz_date_type_key";

-- CreateIndex
CREATE UNIQUE INDEX "quiz_date_type_deleted_at_key" ON "quiz"("date", "type", "deleted_at");
