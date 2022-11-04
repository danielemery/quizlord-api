-- Custom data migration to backfill uploaded by user based on email
ALTER TABLE "quiz" 
  ADD COLUMN "uploaded_by_user_id" TEXT NULL;

UPDATE "quiz" SET "uploaded_by_user_id" = "uploaded_by_user"."id"
FROM "quiz" as "quiz_data"
INNER JOIN "user" as "uploaded_by_user" ON "quiz_data"."uploaded_by" = "uploaded_by_user"."email"
WHERE "uploaded_by_user"."email" = "quiz"."uploaded_by";

-- Now set schema to match prisma spec
ALTER TABLE "quiz" ALTER COLUMN   "uploaded_by_user_id" SET NOT NULL;
ALTER TABLE "quiz" DROP COLUMN "uploaded_by";

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "name" TEXT;

-- AddForeignKey
ALTER TABLE "quiz" ADD CONSTRAINT "quiz_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
