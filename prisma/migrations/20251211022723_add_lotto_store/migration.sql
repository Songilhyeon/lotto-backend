-- AlterTable
ALTER TABLE "LottoNumber" ADD COLUMN     "autoWin" INTEGER,
ADD COLUMN     "manualWin" INTEGER,
ADD COLUMN     "semiAutoWin" INTEGER;

-- CreateTable
CREATE TABLE "LottoStore" (
    "id" SERIAL NOT NULL,
    "drwNo" INTEGER NOT NULL,
    "store" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "autoWin" INTEGER,
    "semiAutoWin" INTEGER,
    "manualWin" INTEGER,

    CONSTRAINT "LottoStore_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "LottoStore" ADD CONSTRAINT "LottoStore_drwNo_fkey" FOREIGN KEY ("drwNo") REFERENCES "LottoNumber"("drwNo") ON DELETE RESTRICT ON UPDATE CASCADE;
