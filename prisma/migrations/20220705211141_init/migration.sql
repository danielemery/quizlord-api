-- CreateEnum
CREATE TYPE "quiz_type" AS ENUM ('BRAINWAVES', 'SHARK');

-- CreateEnum
CREATE TYPE "quiz_state" AS ENUM ('PENDING_UPLOAD', 'READY');

-- CreateTable
CREATE TABLE "quiz" (
    "id" TEXT NOT NULL,
    "type" "quiz_type" NOT NULL,
    "state" "quiz_state" NOT NULL,
    "date" DATE NOT NULL,
    "image_key" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL,
    "uploaded_by" TEXT NOT NULL,

    CONSTRAINT "quiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_completion" (
    "id" TEXT NOT NULL,
    "quiz_id" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL,
    "score" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "quiz_completion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_completion_user" (
    "quiz_completion_id" TEXT NOT NULL,
    "user_email" TEXT NOT NULL,

    CONSTRAINT "quiz_completion_user_pkey" PRIMARY KEY ("quiz_completion_id","user_email")
);

-- CreateIndex
CREATE UNIQUE INDEX "quiz_date_type_key" ON "quiz"("date", "type");

-- AddForeignKey
ALTER TABLE "quiz_completion" ADD CONSTRAINT "quiz_completion_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quiz"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_completion_user" ADD CONSTRAINT "quiz_completion_user_quiz_completion_id_fkey" FOREIGN KEY ("quiz_completion_id") REFERENCES "quiz_completion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
