import { Router, Request, Response } from "express";
import { sortedLottoCache } from "../lib/lottoCache";
import { LottoNumber, OptimizedLottoNumber } from "../types/lotto";
import { ApiResponse } from "../types/api";

const router = Router();

const getNumbers = (item: OptimizedLottoNumber, includeBonus: boolean) => [
  Number(item.drwtNo1),
  Number(item.drwtNo2),
  Number(item.drwtNo3),
  Number(item.drwtNo4),
  Number(item.drwtNo5),
  Number(item.drwtNo6),
  ...(includeBonus ? [Number(item.bnusNo)] : []),
];

// --- 타입 ---
interface AnalysisResult {
  numbers: number[];
  round: number;
  nextNumbers: number[];
}

interface SelectedRound {
  numbers: number[];
  round: number;
}

interface InternalResult extends AnalysisResult {
  matchCount: number;
}

router.get("/", (req: Request, res: Response) => {
  const start = Number(req.query.start);
  const endRaw = Number(req.query.end);
  const minMatch = Number(req.query.minMatch) || 4;
  const includeBonus = req.query.includeBonus === "true";

  // --- parameter 검증 ---
  if (Number.isNaN(start) || Number.isNaN(endRaw)) {
    return res.status(400).json({
      success: false,
      error: "INVALID_PARAMS",
      message: "start 또는 end가 숫자가 아닙니다.",
    } satisfies ApiResponse<null>);
  }

  if (start < 1) {
    return res.status(400).json({
      success: false,
      error: "INVALID_START",
      message: "start 값은 1 이상이어야 합니다.",
    } satisfies ApiResponse<null>);
  }

  if (endRaw < start) {
    return res.status(400).json({
      success: false,
      error: "INVALID_RANGE",
      message: "end 값은 start 값보다 크거나 같아야 합니다.",
    } satisfies ApiResponse<null>);
  }

  if (sortedLottoCache.length === 0) {
    return res.status(500).json({
      success: false,
      error: "NO_CACHE",
      message: "로또 데이터 캐시가 비어 있습니다.",
    } satisfies ApiResponse<null>);
  }

  const latestRound = sortedLottoCache[sortedLottoCache.length - 1];
  const end = Math.min(endRaw, latestRound.drwNo);

  const selected = sortedLottoCache.find((item) => item.drwNo === end);
  if (!selected) {
    return res.status(400).json({
      success: false,
      error: "NO_SELECTED_ROUND",
      message: `회차 ${end} 데이터를 찾을 수 없습니다.`,
    } satisfies ApiResponse<null>);
  }

  const selectedNumbers = getNumbers(selected, includeBonus);
  const selectedRound: SelectedRound = {
    round: selected.drwNo,
    numbers: selectedNumbers,
  };

  // --- 검색 범위 필터 ---
  const records = sortedLottoCache.filter(
    (rec) =>
      rec.drwNo >= start && rec.drwNo <= end && rec.drwNo !== selected.drwNo
  );

  const allResults: InternalResult[] = records
    .map((item) => {
      const numbers = getNumbers(item, includeBonus);
      const matchCount = numbers.filter((n) =>
        selectedNumbers.includes(n)
      ).length;
      const nextItem = sortedLottoCache.find((i) => i.drwNo === item.drwNo + 1);
      const nextNumbers = nextItem ? getNumbers(nextItem, includeBonus) : [];
      return {
        round: item.drwNo,
        numbers,
        nextNumbers,
        matchCount,
      };
    })
    .sort((a, b) => b.round - a.round)
    .filter((r) =>
      minMatch === 4 ? r.matchCount >= minMatch : r.matchCount === minMatch
    );

  // --- 검색된 모든 회차의 nextNumbers 합쳐서 빈도 계산 ---
  const frequency: Record<number, number> = {};
  allResults.forEach((r) => {
    r.nextNumbers.forEach((n) => {
      frequency[n] = (frequency[n] || 0) + 1;
    });
  });

  const results = allResults.map((r) => ({
    round: r.round,
    numbers: r.numbers,
    nextNumbers: r.nextNumbers,
  }));

  const checkNextRound: OptimizedLottoNumber | undefined =
    sortedLottoCache.find((rec) => selected.drwNo + 1 === rec.drwNo);

  const nextRound = checkNextRound
    ? {
        round: checkNextRound.drwNo,
        numbers: getNumbers(checkNextRound, false),
        bonus: checkNextRound.bnusNo,
      }
    : null;

  return res.json({
    success: true,
    data: {
      selectedRound,
      results,
      nextFrequency: frequency,
      nextRound,
    },
    message: "검색된 회차 다음 번호 빈도 포함 분석",
  });
});

export default router;
