import { fetchLottoStores } from "./fetchFirst";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const START = 1203;
  const END = 1203;

  console.log(`🔥 전체 회차 수집 시작: ${START} ~ ${END}`);

  for (let round = START; round <= END; round++) {
    try {
      const result = await fetchLottoStores(round);

      if (!result.stores || result.stores.length === 0) {
        console.warn(`⚠️ 회차 ${round} 1등 판매점 없음 → 스킵`);
        continue;
      }

      for (const store of result.stores) {
        // ⭐ 최종 방어선
        if (!store.store || !store.address || !store.rank) {
          console.warn(`⏭️ 회차 ${round} 잘못된 row 스킵`, store);
          continue;
        }

        await prisma.lottoStore.upsert({
          where: {
            drwNo_store_address_rank: {
              drwNo: result.round,
              store: store.store,
              address: store.address,
              rank: store.rank,
            },
          },
          update: {
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

      console.log(`✔ 저장 완료: ${round}회 (stores: ${result.stores.length})`);
      await new Promise((r) => setTimeout(r, 150));
    } catch (err) {
      console.error(`❌ 회차 ${round} 저장 실패`, err);
    }
  }

  console.log("🎉 전체 회차 크롤링 완료!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
