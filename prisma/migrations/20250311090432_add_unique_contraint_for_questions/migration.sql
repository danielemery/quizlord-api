/*
  Warnings:

  - A unique constraint covering the columns `[quiz_id,question_num]` on the table `quiz_question` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "quiz_question_quiz_id_question_num_key" ON "quiz_question"("quiz_id", "question_num");
