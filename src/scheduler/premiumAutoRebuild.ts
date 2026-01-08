import cron from "node-cron";
import { initializePremiumCache } from "../lib/premiumCache";
import { saveLatestLotto } from "../lib/saveLatestLotto"; // 크롤러 기반으로 수정됨
import { getLatestRound } from "../utils/lottoUtils";

/**
 * Premium 캐시 + DB 갱신 (크롤러 기반)
 */
export async function autoRebuildPremiumCache() {
  try {
    const latestRound = getLatestRound();

    // 2. 최신 회차 DB + LottoStore 크롤링
    await saveLatestLotto(latestRound); // 여기서 크롤러 기반 저장

    // 3. Premium 캐시 재생성
    initializePremiumCache();

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
  console.log("🚀 scheduleWeeklyRebuild() CALLED");
  cron.schedule(
    "10 21 * * 6", // 토요일 21시 10분
    // "37 18 * * 0", // 일요일 18시40분 (테스트용)
    async () => {
      console.log(
        `[CRON] Weekly rebuild started: ${new Date().toLocaleString()}`
      );
      await autoRebuildPremiumCache();
    },
    {
      timezone: "Asia/Seoul",
    }
  );

  console.log("✅ scheduleWeeklyRebuild weekly cron registered");
}
