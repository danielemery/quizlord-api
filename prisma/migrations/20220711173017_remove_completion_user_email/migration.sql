/*
  Warnings:

  - The primary key for the `quiz_completion_user` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `user_email` on the `quiz_completion_user` table. All the data in the column will be lost.
  - Made the column `user_id` on table `quiz_completion_user` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "quiz_completion_user" DROP CONSTRAINT "quiz_completion_user_user_id_fkey";

-- AlterTable
ALTER TABLE "quiz_completion_user" DROP CONSTRAINT "quiz_completion_user_pkey",
DROP COLUMN "user_email",
ALTER COLUMN "user_id" SET NOT NULL,
ADD CONSTRAINT "quiz_completion_user_pkey" PRIMARY KEY ("quiz_completion_id", "user_id");

-- AddForeignKey
ALTER TABLE "quiz_completion_user" ADD CONSTRAINT "quiz_completion_user_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
