import dotenv from "dotenv";
dotenv.config();
import express, { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import cors from "cors";
import cookieParser from "cookie-parser";

// 라우터 import
import lottoGetRoundRouter from "./routes/round";
import lottoGetRoundsRouter from "./routes/rounds";
import lottoHistoryRouter from "./routes/history";
import lottoNextRouter from "./routes/next";
import lottoFrequency from "./routes/frequency";
import lottoNumberLabRouter from "./routes/number-lab";
import authRouter from "./routes/auth";
import lottoPatternRouter from "./routes/pattern";
import lottoRangeRouter from "./routes/range";
import lottoPostsRouter from "./routes/posts";
import lottoPremiumRouter from "./routes/premium";

export const app = express();
export const prisma = new PrismaClient();

// CORS 설정
app.use(
  cors({
    origin: ["http://localhost:3000", "https://lotto-data-lab.vercel.app"],
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

// 라우터 등록
app.use("/api/auth", authRouter);
app.use("/api/posts", lottoPostsRouter);
app.use("/api/lotto/pattern", lottoPatternRouter);
app.use("/api/lotto/round", lottoGetRoundRouter);
app.use("/api/lotto/rounds", lottoGetRoundsRouter);
app.use("/api/lotto/frequency", lottoFrequency);
app.use("/api/lotto/history", lottoHistoryRouter);
app.use("/api/lotto/next", lottoNextRouter);
app.use("/api/lotto/range", lottoRangeRouter);
app.use("/api/lotto/numberlab", lottoNumberLabRouter);
app.use("/api/lotto/premium", lottoPremiumRouter);

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
