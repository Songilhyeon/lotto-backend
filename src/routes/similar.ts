import { Router, Request, Response } from "express";
import { sortedLottoCache } from "../lib/lottoCache";
import { LottoNumber } from "../types/lotto";
import { ApiResponse } from "../types/api";

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
  similarCount: number; // 최신 회차와 유사한 번호 개수
}

interface SimilarApiResponse {
  numberStats: Record<number, number>; // 전체 통계
  similarRounds: AnalysisResult[];
}

router.get("/", (req: Request, res: Response) => {
  const limit = Number(req.query.limit) || 50;
  const minMatch = Number(req.query.minMatch) || 4;

  if (!Array.isArray(sortedLottoCache) || sortedLottoCache.length === 0) {
    return res.json({
      success: true,
      data: { numberStats: {}, similarRounds: [] },
      message: "데이터가 없습니다.",
    } satisfies ApiResponse<SimilarApiResponse>);
  }

  const latestRound = sortedLottoCache[sortedLottoCache.length - 1];
  const latestNumbers = getNumbers(latestRound);

  // 최신 limit만큼 가져오기
  const data = sortedLottoCache.slice(-limit);

  // 번호 등장 통계 (전체 데이터 기준)
  const numberStats: Record<number, number> = {};
  data.forEach((item) =>
    getNumbers(item).forEach((num) => {
      numberStats[num] = (numberStats[num] || 0) + 1;
    })
  );

  // 분석 결과 생성
  const similarRounds: AnalysisResult[] = data
    .map((item) => {
      const numbers = getNumbers(item);

      // 회차 내 최고/최저 등장 번호 계산 (해당 회차 번호만)
      const counts = numbers.map((n) => numberStats[n] || 0);
      const maxCount = Math.max(...counts);
      const minCount = Math.min(...counts);

      // 최신 회차와 유사한 번호 개수
      const similarCount = numbers.filter((n) =>
        latestNumbers.includes(n)
      ).length;

      return {
        ...item,
        numbers,
        highlightMost: numbers.some((n) => numberStats[n] === maxCount),
        highlightLeast: numbers.some((n) => numberStats[n] === minCount),
        similarCount,
      };
    })
    // 최소 일치 번호 기준 필터링
    .filter((item) => item.similarCount >= minMatch)
    // 오름차순 정렬
    .sort((a, b) => a.drwNo - b.drwNo);

  return res.json({
    success: true,
    data: {
      numberStats,
      similarRounds,
    } satisfies SimilarApiResponse,
    message: "유사 회차 분석 데이터",
  } satisfies ApiResponse<SimilarApiResponse>);
});

export default router;
