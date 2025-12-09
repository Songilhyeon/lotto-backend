import { Router, Request, Response } from "express";
import { LottoNumber } from "../types/lotto";
import { ApiResponse } from "../types/api";
import { sortedLottoCache } from "../lib/lottoCache";

const router = Router();

// GET /api/lotto/rounds?start=900&end=950
router.get("/", async (req: Request, res: Response) => {
  const start = Number(req.query.start);
  const endRaw = Number(req.query.end);
  const includeBonus = req.query.includeBonus === "true";

  // 1) 숫자 체크
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

  // 2) 캐시 검사
  if (sortedLottoCache.length === 0) {
    return res.status(500).json({
      success: false,
      error: "NO_CACHE",
      message: "로또 데이터 캐시가 비어 있습니다.",
    } satisfies ApiResponse<null>);
  }

  // 3) 최대 회차 보정
  const maxRound = sortedLottoCache[sortedLottoCache.length - 1].drwNo;
  const end = Math.min(endRaw, maxRound);

  // 4) 범위 필터링
  const records = sortedLottoCache.filter(
    (rec) => rec.drwNo >= start && rec.drwNo <= end
  );

  if (records.length === 0) {
    return res.status(404).json({
      success: false,
      error: "EMPTY_RESULT",
      message: "해당 범위 내 로또 정보가 없습니다.",
    } satisfies ApiResponse<null>);
  }

  // 5) 반환 (API 호환성을 위해 문자열로 변환)
  const normalized: LottoNumber[] = records.map((item) => {
    const { sum, ...rest } = item;
    return {
      ...rest,
      firstWinamnt: String(item.firstWinamnt),
      firstPrzwnerCo: String(item.firstPrzwnerCo),
      totSellamnt: String(item.totSellamnt),
      firstAccumamnt: String(item.firstAccumamnt),
    };
  });

  return res.json({
    success: true,
    data: normalized,
    message: `${start}~${end} 회차 로또 데이터`,
  } satisfies ApiResponse<LottoNumber[]>);
});

export default router;
