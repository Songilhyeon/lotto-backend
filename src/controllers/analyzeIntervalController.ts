import { Request, Response } from "express";
import { getPremiumLatestRound, getPremiumRange } from "../lib/premiumCache";
import {
  buildAppearMap,
  buildPatternRoundIndex,
  getLatestIntervalPattern,
  countPatternOccurrences,
  ensembleIntervalPatternNextFreq,
  getCurrentGap,
  getLastGap,
} from "../lib/intervalPattern";

export async function analyzeIntervalController(req: Request, res: Response) {
  try {
    const latest = getPremiumLatestRound();

    const start = Math.max(1, Number(req.query.start ?? 1));
    const end = Math.min(latest, Number(req.query.end ?? latest));

    if (Number.isNaN(start) || Number.isNaN(end) || start > end) {
      return res.status(400).json({ ok: false, error: "invalid range" });
    }

    const rounds = getPremiumRange(start, end);
    if (!rounds.length) {
      return res.json({ ok: true, start, end, perNumber: [], ensemble: [] });
    }

    const base = rounds[rounds.length - 1];
    const appearMap = buildAppearMap(rounds);
    const patternIndex = buildPatternRoundIndex(appearMap);

    const perNumber = Array.from({ length: 45 }, (_, i) => {
      const num = i + 1;
      const latestPattern = getLatestIntervalPattern(appearMap, num);

      // 해당 번호의 해당 패턴 출현 횟수 (범위 내)
      const sampleCount = latestPattern
        ? countPatternOccurrences(appearMap, num, latestPattern, start, end)
        : 0;

      return {
        num,
        latestPattern,
        sampleCount,
        currentGap: getCurrentGap(appearMap, num, end),
        lastGap: getLastGap(appearMap, num, end),
      };
    });

    const ensembleMap = ensembleIntervalPatternNextFreq(rounds, base.numbers);

    return res.json({
      ok: true,
      start,
      end,
      baseRound: base.drwNo,
      baseNumbers: base.numbers,
      perNumber,
      ensemble: [...ensembleMap.entries()]
        .map(([num, score]) => ({ num, score }))
        .sort((a, b) => b.score - a.score),
    });
  } catch (err: any) {
    console.error(err);
    return res
      .status(500)
      .json({ ok: false, error: err.message || "internal error" });
  }
}
