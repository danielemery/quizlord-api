-- AlterTable
ALTER TABLE "quiz" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "deleted_by_user_id" TEXT,
ADD COLUMN     "deletion_reason" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3),
ADD COLUMN     "updated_by_user_id" TEXT;

-- AddForeignKey
ALTER TABLE "quiz" ADD CONSTRAINT "quiz_deleted_by_user_id_fkey" FOREIGN KEY ("deleted_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz" ADD CONSTRAINT "quiz_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
