import { Router, Request, Response } from "express";
import { sortedLottoCache } from "../lib/lottoCache";

const router = Router();

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
    // 기본 6개 번호
    const nums = [
      rec.drwtNo1,
      rec.drwtNo2,
      rec.drwtNo3,
      rec.drwtNo4,
      rec.drwtNo5,
      rec.drwtNo6,
    ];

    // includeBonus가 true이면 보너스 번호 추가
    if (includeBonus) nums.push(rec.bnusNo);

    nums.forEach((n) => frequency[n]++);
  });

  const sorted = Object.entries(frequency).sort((a, b) => b[1] - a[1]);
  const mostFrequentNumber = Number(sorted[0][0]);
  const leastFrequentNumber = Number(sorted[sorted.length - 1][0]);

  return res.json({
    success: true,
    data: {
      start,
      end,
      includeBonus,
      mostFrequentNumber,
      leastFrequentNumber,
      frequency,
    },
  });
});

export default router;
