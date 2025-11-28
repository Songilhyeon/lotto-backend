import { Router, Request, Response } from "express";
import { sortedLottoCache } from "../lib/lottoCache";
import { LottoNumber, OptimizedLottoNumber } from "../types/lotto";

const router = Router();

// 로또 번호 배열 가져오기
const getNumbers = (item: OptimizedLottoNumber, isBonus: boolean) => [
  Number(item.drwtNo1),
  Number(item.drwtNo2),
  Number(item.drwtNo3),
  Number(item.drwtNo4),
  Number(item.drwtNo5),
  Number(item.drwtNo6),
  ...(isBonus ? [Number(item.bnusNo)] : []),
];

interface AnalysisResult {
  drwNo: number;
  numbers: number[];
}

// GET /api/lotto/frequency?start=900&end=950
router.get("/", async (req: Request, res: Response) => {
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
    // includeBonus가 true이면 보너스 번호 추가
    const nums = getNumbers(rec, includeBonus);
    nums.forEach((n) => frequency[n]++);
  });

  const roundResults: AnalysisResult[] = records.map((item) => {
    const nums = getNumbers(item, includeBonus).sort((a, b) => a - b);
    return {
      drwNo: item.drwNo,
      numbers: nums,
    };
  });

  const checkNextRound: OptimizedLottoNumber | undefined =
    sortedLottoCache.find((rec) => rec.drwNo === end + 1);

  const nextRound = checkNextRound
    ? {
        drwNo: checkNextRound.drwNo,
        numbers: getNumbers(checkNextRound, true),
      }
    : null;

  return res.json({
    success: true,
    data: {
      start,
      end,
      includeBonus,
      frequency,
      roundResults,
      nextRound,
    },
  });
});

export default router;
