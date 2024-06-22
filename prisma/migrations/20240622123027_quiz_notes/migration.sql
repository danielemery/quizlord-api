-- CreateEnum
CREATE TYPE "QuizNoteType" AS ENUM ('ILLEGIBLE');

-- CreateTable
CREATE TABLE "quiz_note" (
    "id" TEXT NOT NULL,
    "quiz_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "note_type" "QuizNoteType" NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quiz_note_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "quiz_note" ADD CONSTRAINT "quiz_note_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quiz"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_note" ADD CONSTRAINT "quiz_note_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
