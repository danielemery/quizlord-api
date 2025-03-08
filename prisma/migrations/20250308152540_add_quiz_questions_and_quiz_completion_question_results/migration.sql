-- CreateTable
CREATE TABLE "quiz_completion_question_result" (
    "id" TEXT NOT NULL,
    "quiz_completion_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL,

    CONSTRAINT "quiz_completion_question_result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_question" (
    "id" TEXT NOT NULL,
    "quiz_id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "question_num" INTEGER NOT NULL,

    CONSTRAINT "quiz_question_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "quiz_completion_question_result" ADD CONSTRAINT "quiz_completion_question_result_quiz_completion_id_fkey" FOREIGN KEY ("quiz_completion_id") REFERENCES "quiz_completion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_completion_question_result" ADD CONSTRAINT "quiz_completion_question_result_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "quiz_question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_question" ADD CONSTRAINT "quiz_question_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quiz"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
