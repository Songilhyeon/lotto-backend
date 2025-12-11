import { fetchLottoStores } from "../lib/lottoCrawler";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const START = 263;
  const END = 1201; // 최신 회차

  console.log(`🔥 전체 회차 수집 시작: ${START} ~ ${END}`);

  for (let round = START; round <= END; round++) {
    try {
      const result = await fetchLottoStores(round);
      if (!result || result.stores[0].rank === null) {
        console.warn(`⚠ 회차 ${round} 데이터 없음, 스킵`);
        continue;
      }

      console.log(result);
      // 1️⃣ LottoNumber 저장/업데이트
      await prisma.lottoNumber.upsert({
        where: { drwNo: result.round },
        update: {
          autoWin: result.autoWin,
          semiAutoWin: result.semiAutoWin,
          manualWin: result.manualWin,
        },
        create: {
          drwNo: result.round,
          drwNoDate: new Date(), // 날짜 정보는 API로 업데이트 가능
          drwtNo1: 0,
          drwtNo2: 0,
          drwtNo3: 0,
          drwtNo4: 0,
          drwtNo5: 0,
          drwtNo6: 0,
          bnusNo: 0,
          firstPrzwnerCo: "",
          firstWinamnt: "",
          totSellamnt: "",
          firstAccumamnt: "",
          autoWin: result.autoWin,
          semiAutoWin: result.semiAutoWin,
          manualWin: result.manualWin,
        },
      });

      // 2️⃣ LottoStore 저장 (중복 방지 위해 upsert로 변경)
      for (const store of result.stores) {
        await prisma.lottoStore.upsert({
          where: {
            drwNo_store: {
              drwNo: result.round,
              store: store.store,
            },
          },
          update: {
            address: store.address,
            rank: store.rank,
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
