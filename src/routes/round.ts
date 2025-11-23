import { Router, Request, Response } from "express";
import { LottoNumber } from "../types/lotto";
import { ApiResponse } from "../types/api";
import { prisma } from "../app";
import { lottoCache, sortedLottoCache } from "../lib/lottoCache";

const router = Router();

// 동행복권 API URL 생성
const getLottoAPI = (round: string | number) =>
  `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${round}`;

// GET /api/lotto/:round
router.get("/:round", async (req: Request, res: Response) => {
  const round = Number(req.params.round);

  if (isNaN(round) || round <= 0) {
    return res.status(400).json({
      success: false,
      error: "INVALID_ROUND",
      message: "회차 번호가 잘못되었습니다.",
    });
  }

  const cached = lottoCache.get(round);
  if (cached) {
    return res.json({ success: true, data: cached, message: "cached data" });
  }

  try {
    // DB 조회
    const record = await prisma.lottoNumber.findUnique({
      where: { drwNo: round },
    });

    if (record) {
      lottoCache.set(round, record);

      return res.json({
        success: true,
        data: record,
        message: "database data",
      });
    }

    // -----------------------------
    // 5초 Timeout 적용된 fetch
    // -----------------------------
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    // API 요청
    const apiUrl = getLottoAPI(round);
    const response = await fetch(apiUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      return res.status(502).json({
        success: false,
        error: "API_FETCH_FAILED",
        message: "동행복권 서버에서 데이터를 가져오지 못했습니다.",
      });
    }

    const apiData = await response.json();

    // ❗ 에러 처리: returnValue 가 fail이면 존재하지 않는 회차
    if (apiData.returnValue !== "success") {
      return res.status(404).json({
        success: false,
        error: "ROUND_NOT_FOUND",
        message: `${round}회차는 아직 발표되지 않았습니다.`,
      });
    }

    const saved = await prisma.lottoNumber.create({
      data: {
        ...apiData,
        drwNoDate: new Date(apiData.drwNoDate),
        firstPrzwnerCo: apiData.firstPrzwnerCo.toString(),
        firstWinamnt: apiData.firstWinamnt.toString(),
        totSellamnt: apiData.totSellamnt.toString(),
        firstAccumamnt: apiData.firstAccumamnt.toString(),
      },
    });

    lottoCache.set(round, saved);
    sortedLottoCache.push(saved);
    sortedLottoCache.sort((a, b) => a.drwNo - b.drwNo);

    return res.json({
      success: true,
      data: saved,
      message: "API data",
    });
  } catch (err: any) {
    console.error("API Error:", err);

    if (err.name === "AbortError") {
      return res.status(504).json({
        success: false,
        error: "API_TIMEOUT",
        message: "동행복권 서버 응답 시간이 초과되었습니다.",
      });
    }

    return res.status(500).json({
      success: false,
      error: "SERVER_ERROR",
      message: "서버 오류가 발생했습니다.",
    });
  }
});

export default router;
