-- CreateEnum
CREATE TYPE "quiz_image_type" AS ENUM ('QUESTION', 'ANSWER', 'QUESTION_AND_ANSWER');
CREATE TYPE "quiz_image_state" AS ENUM ('PENDING_UPLOAD', 'READY');

-- CreateTable
CREATE TABLE "quiz_image" (
    "image_key" TEXT NOT NULL,
    "quiz_id" TEXT NOT NULL,
    "type" "quiz_image_type" NOT NULL,
    "state" "quiz_image_state" NOT NULL,

    CONSTRAINT "quiz_image_pkey" PRIMARY KEY ("image_key")
);

-- AddForeignKey
ALTER TABLE "quiz_image" ADD CONSTRAINT "quiz_image_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quiz"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Move quiz images into new table
INSERT INTO "quiz_image"
SELECT "image_key", "id" as "quiz_id", 'QUESTION_AND_ANSWER' AS "type", 'READY' as "state"
FROM "quiz"
WHERE "image_key" IS NOT NULL;

-- AlterTable
ALTER TABLE "quiz" DROP COLUMN "image_key";
ALTER TABLE "quiz" DROP COLUMN "state";

-- DropEnum
DROP TYPE "quiz_state";
