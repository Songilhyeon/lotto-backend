import { app, prisma } from "./app";

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
});

// 프로세스 종료 시 Prisma 연결 해제
const shutdown = async () => {
  console.log("Closing server and Prisma connection...");
  await prisma.$disconnect();
  server.close(() => process.exit(0));
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
