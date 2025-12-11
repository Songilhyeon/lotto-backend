import cron from "node-cron";
import { initializePremiumCache, redis } from "../lib/premiumCache";
import { saveLatestLotto } from "../lib/saveLatestLotto"; // 크롤러 기반으로 수정됨

/**
 * KST 기준 최신 로또 회차 계산
 */
const getLatestRound = (): number => {
  const firstDraw = new Date(2002, 11, 7, 21, 0, 0); // 12월 = 11, KST
  const now = new Date();

  const day = now.getDay(); // 0=일, 6=토
  const diff = 6 - day; // 토요일까지 남은 일수
  const thisSaturday = new Date(now);
  thisSaturday.setDate(now.getDate() + diff);
  thisSaturday.setHours(21, 0, 0, 0);

  const referenceDate =
    now >= thisSaturday
      ? thisSaturday
      : new Date(thisSaturday.getTime() - 7 * 24 * 60 * 60 * 1000);

  const weeksSinceFirst = Math.floor(
    (referenceDate.getTime() - firstDraw.getTime()) / (7 * 24 * 60 * 60 * 1000)
  );

  return weeksSinceFirst + 1;
};

/**
 * Premium 캐시 + DB 갱신 (크롤러 기반)
 */
async function autoRebuildPremiumCache() {
  try {
    const latestRound = getLatestRound();

    // Redis에 저장된 마지막 회차 확인
    const cachedRound = await redis.get("latestRound");
    if (cachedRound && Number(cachedRound) === latestRound) {
      console.log(
        `[${new Date().toLocaleString()}] Already latest round (${latestRound}), no rebuild needed.`
      );
      return;
    }

    // 1. Redis 캐시 초기화
    await redis.flushdb();

    // 2. 최신 회차 DB + LottoStore 크롤링
    await saveLatestLotto(latestRound); // 여기서 크롤러 기반 저장

    // 3. Premium 캐시 재생성
    initializePremiumCache();

    // 4. Redis에 최신 회차 저장
    await redis.set("latestRound", String(latestRound));

    console.log(
      `[${new Date().toLocaleString()}] Premium cache rebuilt for round ${latestRound}`
    );
  } catch (err: any) {
    console.error(
      `[${new Date().toLocaleString()}] Error rebuilding Premium cache:`,
      err
    );
  }
}

/**
 * node-cron 기반 스케줄러
 * 매주 토요일 21:00 KST 실행
 */
export function scheduleWeeklyRebuild() {
  cron.schedule("0 12 * * 6", async () => {
    console.log(`[${new Date().toLocaleString()}] Cron job started`);
    await autoRebuildPremiumCache();
  });

  console.log("Premium cache cron scheduler started");
}
