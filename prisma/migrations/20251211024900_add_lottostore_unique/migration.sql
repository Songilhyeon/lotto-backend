/*
  Warnings:

  - A unique constraint covering the columns `[drwNo,store]` on the table `LottoStore` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "LottoStore_drwNo_store_key" ON "LottoStore"("drwNo", "store");
