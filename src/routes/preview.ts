import { Router } from "express";
import { sortedLottoCache } from "../lib/lottoCache";

const router = Router();

/**
 * GET /api/lotto/preview
 * 홈 대시보드용 요약 통계
 */
router.get("/", (req, res) => {
  try {
    const recent = Math.min(Number(req.query.recent) || 20, 50);

    const total = sortedLottoCache.length;
    if (total === 0) {
      return res.status(503).json({ message: "Cache not ready" });
    }

    // ✅ 최신 N회 (오름차순 유지)
    const recentRounds = sortedLottoCache.slice(Math.max(0, total - recent));

    const freq = Array(46).fill(0);
    const rangeStats = {
      "1-10": 0,
      "11-20": 0,
      "21-30": 0,
      "31-40": 0,
      "41-45": 0,
    };

    for (const r of recentRounds) {
      const nums = [
        r.drwtNo1,
        r.drwtNo2,
        r.drwtNo3,
        r.drwtNo4,
        r.drwtNo5,
        r.drwtNo6,
      ];

      for (const n of nums) {
        if (n < 1 || n > 45) continue;

        freq[n]++;

        if (n <= 10) rangeStats["1-10"]++;
        else if (n <= 20) rangeStats["11-20"]++;
        else if (n <= 30) rangeStats["21-30"]++;
        else if (n <= 40) rangeStats["31-40"]++;
        else rangeStats["41-45"]++;
      }
    }

    // TOP 5 번호
    const topNumbers = freq
      .map((count, number) => ({ number, count }))
      .filter((v) => v.number > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Hot / Cold (SEO 문장용)
    const hotNumbers = topNumbers.slice(0, 3).map((v) => v.number);

    const coldNumbers = freq
      .map((count, number) => ({ number, count }))
      .filter((v) => v.number > 0)
      .sort((a, b) => a.count - b.count)
      .slice(0, 2)
      .map((v) => v.number);

    res.json({
      base: {
        recentRounds: recent,
        from: recentRounds[0].drwNo,
        to: recentRounds[recentRounds.length - 1].drwNo,
      },
      topNumbers,
      rangeStats: Object.entries(rangeStats).map(([range, count]) => ({
        range,
        count,
      })),
      summary: {
        hotNumbers,
        coldNumbers,
      },
    });
  } catch (err) {
    console.error("analyze/preview error", err);
    res.status(500).json({ message: "Failed to build preview" });
  }
});

export default router;
