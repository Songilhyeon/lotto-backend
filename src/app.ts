import dotenv from "dotenv";
dotenv.config();
import express, { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import cors from "cors";
import cookieParser from "cookie-parser";

// 라우터 import
import lottoGetRoundRouter from "./routes/round";
import lottoGetRoundsRouter from "./routes/rounds";
import lottoRecordRouter from "./routes/record";
import lottoNextRouter from "./routes/next";
import lottoFrequency from "./routes/frequency";
import lottoNumberLabRouter from "./routes/number-lab";
import authRouter from "./routes/auth";
import lottoRangeRouter from "./routes/range";
import lottoPostsRouter from "./routes/posts";
import lottoPremiumRouter from "./routes/premium";
import lottoStoresStatisticsRouter from "./routes/stores-statistics";
import lottoStoresAllRouter from "./routes/stores-all";
import lottoStoresRoundRouter from "./routes/stores-round";
import lottoStoresHistoryRouter from "./routes/stores-history";
import lottoStoresTimelineRouter from "./routes/stores-timeline";
import subscriptionRouter from "./routes/subscription";

export const app = express();

export const prisma = new PrismaClient();

const visitedIPs = new Set<string>();
// 서버 시작 시 기존 정보 읽어 총 방문자 수 초기화
let totalVisits = 0;
const getToday = () => new Date().toISOString().split("T")[0];

const allowedOrigins = ["http://localhost:3000"];
if (process.env.FRONTEND_URL) allowedOrigins.push(process.env.FRONTEND_URL);

// CORS 설정
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

app.get("/api/visit", (req: Request, res: Response) => {
  try {
    const ip =
      req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
    const today = getToday();
    const ipKey = `${today}:${ip}`;

    // 오늘 방문 IP가 아직 없으면 기록
    if (!visitedIPs.has(ipKey)) {
      visitedIPs.add(ipKey);
      totalVisits++; // 메모리 카운트 증가
    }

    // totalVisits는 메모리에서 바로 반환 → 빠른 응답
    res.json({ message: "Visit logged", totalVisits });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to log visit" });
  }
});

// 라우터 등록
app.use("/api/auth", authRouter);
app.use("/api/posts", lottoPostsRouter);
app.use("/api/subscribe", subscriptionRouter);
app.use("/api/lotto/round", lottoGetRoundRouter);
app.use("/api/lotto/rounds", lottoGetRoundsRouter);
app.use("/api/lotto/frequency", lottoFrequency);
app.use("/api/lotto/record", lottoRecordRouter);
app.use("/api/lotto/next", lottoNextRouter);
app.use("/api/lotto/range", lottoRangeRouter);
app.use("/api/lotto/numberlab", lottoNumberLabRouter);
app.use("/api/lotto/premium", lottoPremiumRouter);
app.use("/api/lotto/stores/round", lottoStoresRoundRouter);
app.use("/api/lotto/stores/history", lottoStoresHistoryRouter);
app.use("/api/lotto/stores/timeline", lottoStoresTimelineRouter);
app.use("/api/lotto/stores/statistics", lottoStoresStatisticsRouter);
app.use("/api/lotto/stores/all", lottoStoresAllRouter);

// 기본 라우트
app.get("/", (req: Request, res: Response) => {
  res.json({
    message: "Express + Prisma + Lotto API Server (TypeScript + dotenv)",
  });
});

// 에러 핸들링
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: "Server Error" });
});
