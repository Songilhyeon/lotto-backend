import { Router, Request, Response } from "express";
import { LottoNumber } from "../types/lotto";
import { ApiResponse } from "../types/api";
import { prisma } from "../app";
import { lottoCache, sortedLottoCache } from "../lib/lottoCache";

const router = Router();

// 동행복권 API URL 생성
const getLottoAPI = (round: string | number) =>
  `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${round}`;

// GET /api/lotto/statistics?start=900&end=950
router.get("/statistics", async (req: Request, res: Response) => {
  const start = Number(req.query.start);
  let end = Number(req.query.end);
  const includeBonus = req.query.includeBonus === "true";

  if (!start || !end || start <= 0 || end < start) {
    return res.status(400).json({
      success: false,
      error: "INVALID_RANGE",
      message: "start/end 값이 잘못되었습니다.",
    });
  }

  const maxRound = sortedLottoCache[sortedLottoCache.length - 1].drwNo;

  if (end > maxRound) {
    end = maxRound;
  }

  // 🔹 start~end 범위 필터링
  const records = sortedLottoCache.filter(
    (rec) => rec.drwNo >= start && rec.drwNo <= end
  );
  if (records.length === 0) {
    return res.status(404).json({
      success: false,
      message: "해당 범위 내 로또 정보가 없습니다.",
    });
  }

  // 🔹 번호 빈도 계산
  const frequency: Record<number, number> = {};
  for (let i = 1; i <= 45; i++) frequency[i] = 0;

  records.forEach((rec) => {
    // 기본 6개 번호
    const nums = [
      rec.drwtNo1,
      rec.drwtNo2,
      rec.drwtNo3,
      rec.drwtNo4,
      rec.drwtNo5,
      rec.drwtNo6,
    ];

    // includeBonus가 true이면 보너스 번호 추가
    if (includeBonus) nums.push(rec.bnusNo);

    nums.forEach((n) => frequency[n]++);
  });

  const sorted = Object.entries(frequency).sort((a, b) => b[1] - a[1]);
  const mostFrequentNumber = Number(sorted[0][0]);
  const leastFrequentNumber = Number(sorted[sorted.length - 1][0]);

  return res.json({
    success: true,
    data: {
      start,
      end,
      includeBonus,
      mostFrequentNumber,
      leastFrequentNumber,
      frequency,
    },
  });
});

// GET /api/lotto/:round
router.get("/:round", async (req: Request, res: Response) => {
  const round = Number(req.params.round);

  if (!round || round <= 0) {
    return res.status(400).json({
      success: false,
      error: "INVALID_ROUND",
      message: "회차 번호가 잘못되었습니다.",
    } satisfies ApiResponse<null>);
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
      } satisfies ApiResponse<LottoNumber>);
    }

    // API 요청
    const apiUrl = getLottoAPI(round);
    const response = await fetch(apiUrl);
    const apiData = await response.json();

    // ❗ 에러 처리: returnValue 가 fail이면 존재하지 않는 회차
    if (apiData.returnValue !== "success") {
      return res.status(404).json({
        success: false,
        error: "ROUND_NOT_FOUND",
        message: `${round}회차는 아직 발표되지 않았습니다.`,
      } satisfies ApiResponse<null>);
    }

    const saved = await prisma.lottoNumber.create({
      data: {
        drwNo: apiData.drwNo,
        drwNoDate: new Date(apiData.drwNoDate),
        drwtNo1: apiData.drwtNo1,
        drwtNo2: apiData.drwtNo2,
        drwtNo3: apiData.drwtNo3,
        drwtNo4: apiData.drwtNo4,
        drwtNo5: apiData.drwtNo5,
        drwtNo6: apiData.drwtNo6,
        bnusNo: apiData.bnusNo,
        firstPrzwnerCo: apiData.firstPrzwnerCo.toString(),
        firstWinamnt: apiData.firstWinamnt.toString(),
        totSellamnt: apiData.totSellamnt.toString(),
        firstAccumamnt: apiData.firstAccumamnt.toString(),
      },
    });

    lottoCache.set(round, saved);
    sortedLottoCache.push(saved);

    return res.json({
      success: true,
      data: saved,
      message: "API data",
    } satisfies ApiResponse<LottoNumber>);
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      error: "SERVER_ERROR",
      message: "서버 오류가 발생했습니다.",
    } satisfies ApiResponse<null>);
  }
});

export default router;
