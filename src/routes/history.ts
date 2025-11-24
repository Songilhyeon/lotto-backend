import { Router, Request, Response } from "express";
import { LottoNumber } from "../types/lotto";
import { ApiResponse } from "../types/api";
import { sortedLottoCache } from "../lib/lottoCache";

const router = Router();

// 숫자 변환 헬퍼
// const toNumber = (value: string) => Number(value) || 0;
/* -----------------------------------
 * 안전한 숫자 변환 (undefined, null, "" 모두 대응)
 * ----------------------------------- */
const toNumber = (value: any): number => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

// 번호 배열 추출 헬퍼
const getNumbers = (item: LottoNumber): number[] => [
  toNumber(item.drwtNo1),
  toNumber(item.drwtNo2),
  toNumber(item.drwtNo3),
  toNumber(item.drwtNo4),
  toNumber(item.drwtNo5),
  toNumber(item.drwtNo6),
];

/* -----------------------------------------
 * 공통: reduce 안전 실행 (data.length === 0 방지)
 * ----------------------------------------- */
// const safeReduce = (
//   arr: LottoNumber[],
//   compareFn: (prev: LottoNumber, cur: LottoNumber) => LottoNumber
// ): LottoNumber | null => {
//   if (!Array.isArray(arr) || arr.length === 0) return null;
//   return arr.reduce(compareFn);
// };

type HandlerReturn = LottoNumber | LottoNumber[] | null;
type HandlerWithLimit = (data: LottoNumber[], limit?: number) => HandlerReturn;

/* -----------------------------
 * 쿼리 핸들러 정의
 * ----------------------------- */
const queryHandlers: Record<string, HandlerWithLimit> = {
  // 1) 상위 당첨금
  maxWin: (data, limit = 5) => {
    if (!data || data.length === 0) return null;
    const sorted = [...data].sort(
      (a, b) => toNumber(b.firstWinamnt) - toNumber(a.firstWinamnt)
    );
    return sorted.slice(0, limit);
  },

  // 2) 최소 당첨금 (1등 수상자가 있는 경우)
  minWin: (data, limit = 5) => {
    const filtered = data.filter((item) => toNumber(item.firstPrzwnerCo) > 0);
    const sorted = [...filtered].sort(
      (a, b) => toNumber(a.firstWinamnt) - toNumber(b.firstWinamnt)
    );
    return sorted.slice(0, limit);
  },

  // 3) 최대 당첨자 수
  maxWinners: (data, limit = 5) => {
    const sorted = [...data].sort(
      (a, b) => toNumber(b.firstPrzwnerCo) - toNumber(a.firstPrzwnerCo)
    );
    return sorted.slice(0, limit);
  },

  // 4) 최대 판매금액
  maxSell: (data, limit = 5) => {
    const sorted = [...data].sort(
      (a, b) => toNumber(b.totSellamnt) - toNumber(a.totSellamnt)
    );
    return sorted.slice(0, limit);
  },

  // 5) 최저 판매금액
  minSell: (data, limit = 5) => {
    const sorted = [...data].sort(
      (a, b) => toNumber(a.totSellamnt) - toNumber(b.totSellamnt)
    );
    return sorted.slice(0, limit);
  },

  // 6) 번호 합 최대
  sumMax: (data, limit = 5) => {
    const sorted = [...data].sort((a, b) => {
      const sumA = getNumbers(a).reduce((x, y) => x + y, 0);
      const sumB = getNumbers(b).reduce((x, y) => x + y, 0);
      return sumB - sumA;
    });
    return sorted.slice(0, limit);
  },

  // 7) 번호 합 최소
  sumMin: (data, limit = 5) => {
    const sorted = [...data].sort((a, b) => {
      const sumA = getNumbers(a).reduce((x, y) => x + y, 0);
      const sumB = getNumbers(b).reduce((x, y) => x + y, 0);
      return sumA - sumB;
    });
    return sorted.slice(0, limit);
  },
};

/* -----------------------------
 * GET /api/lotto/history
 * ----------------------------- */
router.get("/", (req: Request, res: Response) => {
  const query = req.query.query as string | undefined;
  const limit = Number(req.query.limit) || 5;
  const start = Number(req.query.start) || 1;
  const end =
    Number(req.query.end) ||
    sortedLottoCache[sortedLottoCache.length - 1].drwNo;

  // 1) 쿼리 검사
  if (!query) {
    return res.status(400).json({
      success: false,
      error: "INVALID_QUERY",
      message: "쿼리를 입력해주세요. (예: maxWin, minWin)",
    } satisfies ApiResponse<null>);
  }

  // 2) 캐시 검사
  if (!sortedLottoCache || sortedLottoCache.length === 0) {
    return res.json({
      success: true,
      data: [],
      message: "데이터가 없습니다.",
    } satisfies ApiResponse<LottoNumber[]>);
  }

  // 3) 핸들러 찾기
  const handler = queryHandlers[query];
  if (!handler) {
    return res.status(400).json({
      success: false,
      error: "UNKNOWN_QUERY",
      message: "알 수 없는 쿼리입니다.",
    } satisfies ApiResponse<null>);
  }

  const rangedData = sortedLottoCache.filter(
    (item) => item.drwNo >= start && item.drwNo <= end
  );

  // 4) 실행
  const result = handler(rangedData, limit);
  let output: LottoNumber[] = [];

  if (Array.isArray(result)) {
    output = result;
  } else if (result) {
    output = [result];
  } // null이면 빈 배열

  // 5) 숫자 문자열 변환 (일관성)
  const normalized = output.map((item) => ({
    ...item,
    firstWinamnt: String(toNumber(item.firstWinamnt)),
    firstPrzwnerCo: String(toNumber(item.firstPrzwnerCo)),
    totSellamnt: String(toNumber(item.totSellamnt)),
    firstAccumamnt: String(toNumber(item.firstAccumamnt)),
  }));

  return res.json({
    success: true,
    data: normalized,
    message: "Cached data",
  } satisfies ApiResponse<LottoNumber[]>);
});

export default router;
