import { Router, Request, Response } from "express";
import { LottoNumber } from "../types/lotto";
import { ApiResponse } from "../types/api";
import { sortedLottoCache } from "../lib/lottoCache";

const router = Router();

// 숫자 변환 헬퍼
const toNumber = (value: string) => Number(value) || 0;

// 번호 배열 추출 헬퍼
const getNumbers = (item: LottoNumber) => [
  item.drwtNo1,
  item.drwtNo2,
  item.drwtNo3,
  item.drwtNo4,
  item.drwtNo5,
  item.drwtNo6,
];

// 쿼리별 연산 함수 정의
const queryHandlers: Record<
  string,
  (data: LottoNumber[]) => LottoNumber | null
> = {
  maxWin: (data) =>
    data.reduce((prev, cur) =>
      toNumber(cur.firstWinamnt) > toNumber(prev.firstWinamnt) ? cur : prev
    ),
  minWin: (data) => {
    const filtered = data.filter((item) => toNumber(item.firstPrzwnerCo) > 0);
    if (filtered.length === 0) return null;
    return filtered.reduce((prev, cur) =>
      toNumber(cur.firstWinamnt) < toNumber(prev.firstWinamnt) ? cur : prev
    );
  },
  maxWinners: (data) =>
    data.reduce((prev, cur) =>
      toNumber(cur.firstPrzwnerCo) > toNumber(prev.firstPrzwnerCo) ? cur : prev
    ),
  maxSell: (data) =>
    data.reduce((prev, cur) =>
      toNumber(cur.totSellamnt) > toNumber(prev.totSellamnt) ? cur : prev
    ),

  sumMax: (data) =>
    data.reduce((prev, cur) => {
      const sumPrev = getNumbers(prev).reduce((a, b) => a + b, 0);
      const sumCur = getNumbers(cur).reduce((a, b) => a + b, 0);
      return sumCur > sumPrev ? cur : prev;
    }),

  sumMin: (data) =>
    data.reduce((prev, cur) => {
      const sumPrev = getNumbers(prev).reduce((a, b) => a + b, 0);
      const sumCur = getNumbers(cur).reduce((a, b) => a + b, 0);
      return sumCur < sumPrev ? cur : prev;
    }),
};

// GET /api/lotto/history?query="maxWin", "minWin", "maxWinners", "maxSell"
router.get("/", (req: Request, res: Response) => {
  const { query } = req.query;

  if (!query || typeof query !== "string") {
    return res.status(400).json({
      success: false,
      error: "INVALID_QUERY",
      message: "쿼리를 입력해주세요.",
    } satisfies ApiResponse<null>);
  }

  if (!Array.isArray(sortedLottoCache) || sortedLottoCache.length === 0) {
    return res.json({
      success: true,
      data: [],
      message: "데이터가 없습니다.",
    } satisfies ApiResponse<LottoNumber[]>);
  }

  let data: LottoNumber[] = [...sortedLottoCache];

  // 쿼리 핸들러
  const handler = queryHandlers[query];
  if (!handler) {
    return res.status(400).json({
      success: false,
      error: "UNKNOWN_QUERY",
      message: "알 수 없는 쿼리입니다.",
    } satisfies ApiResponse<null>);
  }

  const result = handler(data);

  if (!result) {
    return res.json({
      success: true,
      data: [],
      message: "결과가 없습니다.",
    } satisfies ApiResponse<LottoNumber[]>);
  }

  // Number로 계산 후 문자열로 변환
  const converted: LottoNumber = {
    ...result,
    firstWinamnt: String(toNumber(result.firstWinamnt)),
    firstPrzwnerCo: String(toNumber(result.firstPrzwnerCo)),
    totSellamnt: String(toNumber(result.totSellamnt)),
    firstAccumamnt: String(toNumber(result.firstAccumamnt)),
  };

  return res.json({
    success: true,
    data: [converted],
    message: "Cached data",
  } satisfies ApiResponse<LottoNumber[]>);
});

export default router;
