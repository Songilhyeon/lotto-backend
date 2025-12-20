// 실행 npx ts-node src/scripts/fetchAllFirst.ts
import { fetchLottoStores } from "./fetchFirst";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const START = 1203;
  const END = 1203; // 최신 회차

  console.log(`🔥 전체 회차 수집 시작: ${START} ~ ${END}`);

  for (let round = START; round <= END; round++) {
    try {
      const result = await fetchLottoStores(round);
      if (!result || result.stores[0].rank === null) {
        console.warn(`⚠ 회차 ${round} 데이터 없음, 스킵`);
        continue;
      }

      // 2️⃣ LottoStore 저장 (중복 방지 위해 upsert로 변경)
      for (const store of result.stores) {
        await prisma.lottoStore.upsert({
          where: {
            drwNo_store_address_rank: {
              drwNo: result.round,
              store: store.store,
              address: store.address ?? "",
              rank: store.rank ?? 1,
            },
          },
          update: {
            address: store.address ?? "",
            rank: store.rank ?? 0,
            autoWin: store.autoWin ?? 0,
            semiAutoWin: store.semiAutoWin ?? 0,
            manualWin: store.manualWin ?? 0,
          },
          create: {
            drwNo: result.round,
            store: store.store,
            address: store.address,
            rank: store.rank,
            autoWin: store.autoWin ?? 0,
            semiAutoWin: store.semiAutoWin ?? 0,
            manualWin: store.manualWin ?? 0,
          },
        });
      }

      console.log(`✔ 저장 완료: ${round}회`);
      await new Promise((r) => setTimeout(r, 150)); // 서버 부담 최소화
    } catch (err) {
      console.error(`❌ 회차 ${round} 저장 실패`, err);
    }
  }

  console.log("🎉 전체 회차 크롤링 완료!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
