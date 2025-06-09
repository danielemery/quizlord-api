-- AlterTable
ALTER TABLE "quiz" ADD COLUMN     "ai_processing_model" TEXT;

-- Where processing has already been done, set the model to 'gemini-2.0-flash-lite'
UPDATE "quiz" 
SET "ai_processing_model" = 'gemini-2.0-flash-lite' 
WHERE "ai_processing_model" IS NULL
AND "ai_processing_state" != 'NOT_QUEUED';
