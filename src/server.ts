import dotenv from "dotenv";
dotenv.config(); // .env 파일 로드

import { app, prisma } from "./app";
import { getLottoData } from "./lib/lottoCache";
import { initializePremiumCache } from "./lib/premiumCache";
import { scheduleWeeklyRebuild } from "./scheduler/premiumAutoRebuild";

const PORT = process.env.PORT || 4000;

async function bootstrap() {
  try {
    const now = new Date();
    console.log(">>> 서버 부트스트랩 시작", now.toLocaleString());

    // 1️⃣ 무료 로또 캐시 초기화
    await getLottoData();
    console.log(">>> Free Lotto Cache 초기화 완료");

    // 2️⃣ Premium 캐시 초기화 (sortedLottoCache 사용)
    initializePremiumCache();
    console.log(">>> Premium Cache 초기화 완료");

    // 3️⃣ 서버 시작
    const server = app.listen(PORT, () => {
      console.log(`>>> Server running on port ${PORT}`);
      scheduleWeeklyRebuild();
    });

    // 4️⃣ 종료 시 Prisma 연결 해제
    const shutdown = async () => {
      console.log("Closing server and Prisma connection...");
      await prisma.$disconnect();
      server.close(() => process.exit(0));
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (err) {
    console.error("Server bootstrap failed:", err);
    process.exit(1);
  }
}

bootstrap();
