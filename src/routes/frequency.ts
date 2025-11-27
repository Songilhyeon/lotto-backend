import { Router, Request, Response } from "express";
import { sortedLottoCache } from "../lib/lottoCache";
import { LottoNumber } from "../types/lotto";

const router = Router();

// 로또 번호 배열 가져오기
const getNumbers = (item: LottoNumber, isBonus: boolean) => [
  item.drwtNo1,
  item.drwtNo2,
  item.drwtNo3,
  item.drwtNo4,
  item.drwtNo5,
  item.drwtNo6,
  ...(isBonus ? [item.bnusNo] : []),
];

interface AnalysisResult {
  drwNo: number;
  numbers: number[];
}

// GET /api/lotto/statistics?start=900&end=950
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
  // OR
  // 번호 등장 횟수 계산 (보너스 제외)
  // const counts: Record<number, number> = {};
  // records.forEach((item) => {
  //   getNumbers(item).forEach((num) => {
  //     counts[num] = (counts[num] || 0) + 1;
  //   });
  // });

  const roundResults: AnalysisResult[] = records.map((item) => {
    const nums = getNumbers(item, includeBonus).sort((a, b) => a - b);
    return {
      drwNo: item.drwNo,
      numbers: nums,
    };
  });

  const checkNextRound: LottoNumber | undefined = sortedLottoCache.find(
    (rec) => rec.drwNo === end + 1
  );

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
