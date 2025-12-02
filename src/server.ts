import { app, prisma } from "./app";
import { getLottoData } from "./lib/lottoCache";

const PORT = process.env.PORT || 4000;

const server = app.listen(PORT, async () => {
  try {
    console.log(`Server is running on port ${PORT}`);
    await getLottoData(); // 캐싱
  } catch (err) {
    console.error("Lotto caching failed:", err);
  }
});

// 프로세스 종료 시 Prisma 연결 해제
const shutdown = async () => {
  console.log("Closing server and Prisma connection...");
  await prisma.$disconnect();
  server.close(() => process.exit(0));
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
