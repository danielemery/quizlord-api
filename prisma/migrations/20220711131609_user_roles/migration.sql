-- CreateEnum
CREATE TYPE "role" AS ENUM ('USER', 'ADMIN');

-- AlterTable
ALTER TABLE "quiz_completion_user" ADD COLUMN     "user_id" TEXT;

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_role" (
    "user_id" TEXT NOT NULL,
    "role" "role" NOT NULL,

    CONSTRAINT "user_role_pkey" PRIMARY KEY ("user_id","role")
);

-- AddForeignKey
ALTER TABLE "quiz_completion_user" ADD CONSTRAINT "quiz_completion_user_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Generate a user for each email that's completed a quiz
insert into "user" 
select gen_random_uuid () as id, email from (select distinct user_email as email from quiz_completion_user) as unique_completions;

-- Update quiz completion row to also refer to the created user
update quiz_completion_user
set user_id = "user".id
from "user"
where "user".email = quiz_completion_user.user_email;
