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
const safeReduce = (
  arr: LottoNumber[],
  compareFn: (prev: LottoNumber, cur: LottoNumber) => LottoNumber
): LottoNumber | null => {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr.reduce(compareFn);
};

/* -----------------------------
 * 쿼리 핸들러 정의
 * ----------------------------- */
const queryHandlers: Record<
  string,
  (data: LottoNumber[]) => LottoNumber | null
> = {
  maxWin: (data) =>
    safeReduce(data, (prev, cur) =>
      toNumber(cur.firstWinamnt) > toNumber(prev.firstWinamnt) ? cur : prev
    ),

  minWin: (data) => {
    const filtered = data.filter((item) => toNumber(item.firstPrzwnerCo) > 0);
    return safeReduce(filtered, (prev, cur) =>
      toNumber(cur.firstWinamnt) < toNumber(prev.firstWinamnt) ? cur : prev
    );
  },

  maxWinners: (data) =>
    safeReduce(data, (prev, cur) =>
      toNumber(cur.firstPrzwnerCo) > toNumber(prev.firstPrzwnerCo) ? cur : prev
    ),

  maxSell: (data) =>
    safeReduce(data, (prev, cur) =>
      toNumber(cur.totSellamnt) > toNumber(prev.totSellamnt) ? cur : prev
    ),

  sumMax: (data) =>
    safeReduce(data, (prev, cur) => {
      const prevSum = getNumbers(prev).reduce((a, b) => a + b, 0);
      const curSum = getNumbers(cur).reduce((a, b) => a + b, 0);
      return curSum > prevSum ? cur : prev;
    }),

  sumMin: (data) =>
    safeReduce(data, (prev, cur) => {
      const prevSum = getNumbers(prev).reduce((a, b) => a + b, 0);
      const curSum = getNumbers(cur).reduce((a, b) => a + b, 0);
      return curSum < prevSum ? cur : prev;
    }),
};

// GET /api/lotto/history?query="maxWin", "minWin", "maxWinners", "maxSell"
router.get("/", (req: Request, res: Response) => {
  const query = req.query.query as string | undefined;

  // 1) 쿼리 검사
  if (!query) {
    return res.status(400).json({
      success: false,
      error: "INVALID_QUERY",
      message: "쿼리를 입력해주세요. (예: maxWin, minWin)",
    } satisfies ApiResponse<null>);
  }

  // 2) 캐시 검사
  if (sortedLottoCache.length === 0) {
    return res.json({
      success: true,
      data: [],
      message: "데이터가 없습니다.",
    } satisfies ApiResponse<LottoNumber[]>);
  }

  let data: LottoNumber[] = [...sortedLottoCache];

  // 3) 핸들러 찾기
  const handler = queryHandlers[query];
  if (!handler) {
    return res.status(400).json({
      success: false,
      error: "UNKNOWN_QUERY",
      message: "알 수 없는 쿼리입니다.",
    } satisfies ApiResponse<null>);
  }

  // 4) 실행
  const result = handler(sortedLottoCache);
  if (!result) {
    return res.json({
      success: true,
      data: [],
      message: "결과가 없습니다.",
    } satisfies ApiResponse<LottoNumber[]>);
  }

  // 5) 숫자들을 문자열로 재정렬 (일관성 유지)
  const normalized: LottoNumber = {
    ...result,
    firstWinamnt: String(toNumber(result.firstWinamnt)),
    firstPrzwnerCo: String(toNumber(result.firstPrzwnerCo)),
    totSellamnt: String(toNumber(result.totSellamnt)),
    firstAccumamnt: String(toNumber(result.firstAccumamnt)),
  };

  return res.json({
    success: true,
    data: [normalized],
    message: "Cached data",
  } satisfies ApiResponse<LottoNumber[]>);
});

export default router;
