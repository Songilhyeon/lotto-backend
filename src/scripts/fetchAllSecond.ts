// 실행 npx ts-node src/scripts/fetchAllSecond.ts
import { fetchLottoStores } from "./fetchSecond";
// import { fetchLottoStores } from "../lib/lottoCrawler";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const START = 1203;
  const END = 1203; // 최신 회차

  console.log(`🔥 전체 회차 수집 시작: ${START} ~ ${END}`);

  for (let round = START; round <= END; round++) {
    try {
      const result = await fetchLottoStores(round);
      if (!result || result === null) {
        console.warn(`⚠ 회차 ${round} 데이터 없음, 스킵`);
        continue;
      }

      for (const store of result) {
        await prisma.lottoStore.upsert({
          where: {
            drwNo_store_address_rank: {
              drwNo: round,
              store: store.store,
              address: store.address ?? "",
              rank: store.rank ?? 2,
            },
          },
          update: {
            autoWin: store.autoWin ?? 1,
            semiAutoWin: store.rank === 1 ? store.semiAutoWin ?? 0 : null,
            manualWin: store.rank === 1 ? store.manualWin ?? 0 : null,
          },
          create: {
            drwNo: round,
            store: store.store,
            address: store.address ?? "",
            rank: store.rank ?? 2,
            autoWin: store.autoWin ?? 1,
            semiAutoWin: store.rank === 1 ? store.semiAutoWin ?? 0 : null,
            manualWin: store.rank === 1 ? store.manualWin ?? 0 : null,
          },
        });

        await new Promise((r) => setTimeout(r, 150)); // 서버 부담 최소화
      }
      console.log(`✔ 저장 완료: 2등 판매점 ${round}회 ${result.length}건`);
    } catch (err) {
      console.error(`❌ 회차 ${round} 저장 실패`, err);
    }
  }

  console.log("🎉 전체 회차 크롤링 완료!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
