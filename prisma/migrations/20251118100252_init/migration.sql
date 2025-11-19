-- CreateTable
CREATE TABLE "LottoNumber" (
    "drwNo" INTEGER NOT NULL,
    "drwNoDate" TIMESTAMP(3) NOT NULL,
    "drwtNo1" INTEGER NOT NULL,
    "drwtNo2" INTEGER NOT NULL,
    "drwtNo3" INTEGER NOT NULL,
    "drwtNo4" INTEGER NOT NULL,
    "drwtNo5" INTEGER NOT NULL,
    "drwtNo6" INTEGER NOT NULL,
    "bnusNo" INTEGER NOT NULL,
    "firstPrzwnerCo" TEXT NOT NULL,
    "firstWinamnt" TEXT NOT NULL,
    "totSellamnt" TEXT NOT NULL,
    "firstAccumamnt" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LottoNumber_pkey" PRIMARY KEY ("drwNo")
);
