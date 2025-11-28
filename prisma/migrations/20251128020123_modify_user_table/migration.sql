-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('FREE', 'PREMIUM');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'FREE',
ADD COLUMN     "subscriptionExpiresAt" TIMESTAMP(3);
