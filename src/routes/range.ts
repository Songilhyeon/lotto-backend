import { Router, Request, Response } from "express";
import { sortedLottoCache } from "../lib/lottoCache";
import { OptimizedLottoNumber } from "../types/lotto";
import { ApiResponse } from "../types/api";

const router = Router();

/** 개별 매칭 회차 정보 */
interface MatchingRoundInfo {
  round: number;
  numbers: number[];
  nextFrequency: Record<number, number>;
}

/** 단위(7,10)별 분석 데이터 */
interface RangeResult {
  counts: Record<string, number>;
  matchingRounds: MatchingRoundInfo[];
  nextFrequency: Record<number, number>;
}

/** API 응답 구조 */
interface ApiData {
  selectedRound: { round: number; numbers: number[] };
  nextRound: { round: number; numbers: number[] } | null;
  ranges: { "10": RangeResult; "7": RangeResult };
}

/** 번호 가져오기 */
const getNumbers = (item: OptimizedLottoNumber, includeBonus: boolean) =>
  [
    item.drwtNo1,
    item.drwtNo2,
    item.drwtNo3,
    item.drwtNo4,
    item.drwtNo5,
    item.drwtNo6,
    ...(includeBonus ? [item.bnusNo] : []),
  ].map(Number);

/** 구간 카운트 */
function getRangeCounts(numbers: number[], unit: number) {
  const max = 45;
  const counts: Record<string, number> = {};

  for (let start = 1; start <= max; start += unit) {
    const end = Math.min(start + unit - 1, max);
    const key = `${start}-${end}`;
    counts[key] = numbers.filter((n) => n >= start && n <= end).length;
  }

  return counts;
}

/** 과거 회차 중 동일 패턴 찾기 */
function findMatchingRounds(
  targetCounts: Record<string, number>,
  unit: number,
  searchRounds: OptimizedLottoNumber[]
): MatchingRoundInfo[] {
  const matches: MatchingRoundInfo[] = [];

  for (const rec of searchRounds) {
    const numbers = getNumbers(rec, false);
    const counts = getRangeCounts(numbers, unit);

    // 패턴 동일성 검사
    const matched = Object.keys(targetCounts).every(
      (key) => counts[key] === targetCounts[key]
    );

    if (!matched) continue;

    // 다음 회차 번호 빈도
    const next = sortedLottoCache.find((i) => i.drwNo === rec.drwNo + 1);
    const nextNumbers = next ? getNumbers(next, false) : [];

    const nextFreq: Record<number, number> = {};
    nextNumbers.forEach((n) => {
      nextFreq[n] = (nextFreq[n] || 0) + 1;
    });

    matches.push({
      round: rec.drwNo,
      numbers,
      nextFrequency: nextFreq,
    });
  }

  return matches;
}

/** 빈도수 합산 */
function accumulateNextFrequencies(
  list: MatchingRoundInfo[]
): Record<number, number> {
  const result: Record<number, number> = {};

  for (const r of list) {
    Object.keys(r.nextFrequency).forEach((n) => {
      const num = Number(n);
      result[num] = (result[num] || 0) + r.nextFrequency[num];
    });
  }

  return result;
}

router.get("/", (req: Request, res: Response) => {
  const start = Number(req.query.start);
  const end = Number(req.query.end);
  const includeBonus = req.query.includeBonus === "true";

  if (Number.isNaN(start) || Number.isNaN(end) || start > end) {
    return res.status(400).json({
      success: false,
      error: "INVALID_RANGE",
      message: "start와 end 값이 잘못되었습니다.",
    } satisfies ApiResponse<null>);
  }

  /** -----------------------
   *  선택된 회차 데이터
   ------------------------*/
  const selected = sortedLottoCache.find((i) => i.drwNo === end);
  if (!selected) {
    return res.status(404).json({
      success: false,
      error: "ROUND_NOT_FOUND",
      message: `${end} 회차 데이터를 찾을 수 없습니다.`,
    } satisfies ApiResponse<null>);
  }
  const selectedNumbers = getNumbers(selected, includeBonus);

  /** -----------------------
   *  다음 회차 NextRound 추가
   ------------------------*/
  const next = sortedLottoCache.find((i) => i.drwNo === end + 1);
  const nextRound = next
    ? {
        round: next.drwNo,
        numbers: getNumbers(next, includeBonus),
      }
    : null; // 마지막 회차면 null

  /** -----------------------
   *  검색 범위 (start ~ end)
   ------------------------*/
  const searchRounds = sortedLottoCache.filter(
    (i) => i.drwNo >= start && i.drwNo < end
  );

  /** ---------- 10단위 분석 ---------- */
  const counts10 = getRangeCounts(selectedNumbers, 10);
  const matching10 = findMatchingRounds(counts10, 10, searchRounds);
  const nextFreq10 = accumulateNextFrequencies(matching10);

  /** ---------- 7단위 분석 ---------- */
  const counts7 = getRangeCounts(selectedNumbers, 7);
  const matching7 = findMatchingRounds(counts7, 7, searchRounds);
  const nextFreq7 = accumulateNextFrequencies(matching7);

  return res.json({
    success: true,
    data: {
      selectedRound: { round: end, numbers: selectedNumbers },
      nextRound, // ← 추가됨
      ranges: {
        "10": {
          counts: counts10,
          matchingRounds: matching10,
          nextFrequency: nextFreq10,
        },
        "7": {
          counts: counts7,
          matchingRounds: matching7,
          nextFrequency: nextFreq7,
        },
      },
    } satisfies ApiData,
    message: `${start} ~ ${end} 구간 패턴 분석 완료`,
  });
});

export default router;
