-- AlterTable
ALTER TABLE "user" ADD COLUMN     "rejected_at" TIMESTAMP(3),
ADD COLUMN     "rejected_by_user_id" TEXT;

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_rejected_by_user_id_fkey" FOREIGN KEY ("rejected_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
