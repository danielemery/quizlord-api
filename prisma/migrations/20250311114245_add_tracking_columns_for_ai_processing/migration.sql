-- CreateEnum
CREATE TYPE "quiz_ai_processing_state" AS ENUM ('NOT_QUEUED', 'QUEUED', 'COMPLETED', 'ERRORED');

-- AlterTable
ALTER TABLE "quiz" ADD COLUMN     "ai_processing_certainty_percent" DECIMAL(65,30),
ADD COLUMN     "ai_processing_state" "quiz_ai_processing_state" NOT NULL DEFAULT 'NOT_QUEUED';
