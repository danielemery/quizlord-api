-- CreateEnum
CREATE TYPE "quiz_completion_question_result_score" AS ENUM ('CORRECT', 'INCORRECT', 'HALF_CORRECT');

-- CreateTable
CREATE TABLE "quiz_completion_question_result" (
    "id" TEXT NOT NULL,
    "quiz_completion_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "score" "quiz_completion_question_result_score" NOT NULL,

    CONSTRAINT "quiz_completion_question_result_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "quiz_completion_question_result" ADD CONSTRAINT "quiz_completion_question_result_quiz_completion_id_fkey" FOREIGN KEY ("quiz_completion_id") REFERENCES "quiz_completion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_completion_question_result" ADD CONSTRAINT "quiz_completion_question_result_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "quiz_question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
