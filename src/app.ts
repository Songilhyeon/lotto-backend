import dotenv from "dotenv";
dotenv.config(); // .env 파일 로드
import express, { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import cors from "cors";
import lottoGetRoundRouter from "./routes/round";
import lottoGetRoundsRouter from "./routes/rounds";
import lottoHistoryRouter from "./routes/history";
import lottoSimilarRouter from "./routes/similar";
import lottoFrequency from "./routes/frequency";
import lottoNumberLabRouter from "./routes/number-lab";
import { getLottoData } from "./lib/lottoCache";
import cookieParser from "cookie-parser";
import authRouter from "./routes/auth";
import jwt from "jsonwebtoken";

export const app = express();
export const prisma = new PrismaClient();

(async () => {
  await getLottoData();
})();

// CORS 미들웨어 등록
app.use(
  cors({
    origin: "http://localhost:3000", // 허용할 프런트 URL
    credentials: true, // 쿠키 전달 허용
  })
);

app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRouter);

// 보호된 API 예제
app.get("/api/protected", (req, res) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!);
    res.json({ message: "Protected data", user: payload });
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
});

app.use("/api/lotto/round", lottoGetRoundRouter);
app.use("/api/lotto/rounds", lottoGetRoundsRouter);
app.use("/api/lotto/frequency", lottoFrequency);
app.use("/api/lotto/history", lottoHistoryRouter);
app.use("/api/lotto/similar", lottoSimilarRouter);
app.use("/api/lotto/numberlab", lottoNumberLabRouter);

// 기본 라우트
app.get("/", (req: Request, res: Response) => {
  res.json({
    message: "Express + Prisma + Lotto API Server (TypeScript + dotenv)",
  });
});

// 에러 핸들링
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: "Server Error" });
});
