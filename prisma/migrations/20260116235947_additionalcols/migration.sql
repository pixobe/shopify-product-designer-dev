-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "plan" TEXT,
ADD COLUMN     "planExpires" TIMESTAMP(3),
ADD COLUMN     "refreshToken" TEXT,
ADD COLUMN     "refreshTokenExpires" TIMESTAMP(3);
