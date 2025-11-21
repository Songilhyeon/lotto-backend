import { Router, Request, Response } from "express";
import { LottoNumber } from "../types/lotto";
import { ApiResponse } from "../types/api";
import { sortedLottoCache } from "../lib/lottoCache";

const router = Router();

// 로또 번호 배열 가져오기
const getNumbers = (item: LottoNumber) => [
  item.drwtNo1,
  item.drwtNo2,
  item.drwtNo3,
  item.drwtNo4,
  item.drwtNo5,
  item.drwtNo6,
];

interface AnalysisResult extends LottoNumber {
  numbers: number[];
  highlightMost: boolean;
  highlightLeast: boolean;
}

// ----------------- 전체 번호 등장횟수 분석 API -----------------
router.get("/", (req: Request, res: Response) => {
  if (!Array.isArray(sortedLottoCache) || sortedLottoCache.length === 0) {
    return res.json({
      success: true,
      data: [],
      message: "데이터가 없습니다.",
    } satisfies ApiResponse<AnalysisResult[]>);
  }

  const { limit } = req.query;
  const n = limit
    ? Math.min(Math.max(Number(limit), 1), sortedLottoCache.length)
    : sortedLottoCache.length;

  const data = sortedLottoCache.slice(-n).reverse(); // 최신 순

  // 번호 등장 횟수 계산 (보너스 제외)
  const counts: Record<number, number> = {};
  data.forEach((item) => {
    getNumbers(item).forEach((num) => {
      counts[num] = (counts[num] || 0) + 1;
    });
  });

  const mostFreq = Math.max(...Object.values(counts));
  const leastFreq = Math.min(...Object.values(counts));

  const result: AnalysisResult[] = data.map((item) => {
    const nums = getNumbers(item).sort((a, b) => a - b);
    return {
      ...item,
      numbers: nums,
      highlightMost: nums.some((n) => counts[n] === mostFreq),
      highlightLeast: nums.some((n) => counts[n] === leastFreq),
    };
  });

  return res.json({
    success: true,
    data: result,
    message: `최근 ${n}회차 분석 데이터`,
  } satisfies ApiResponse<AnalysisResult[]>);
});

export default router;
