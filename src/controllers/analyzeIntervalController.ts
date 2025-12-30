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
  buildPerNumberCountInRange,
} from "../lib/intervalPattern";
import { sortedLottoCache } from "../lib/lottoCache";
import { extractNumbers } from "../utils/lottoNumberUtils";

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
      return res.json({
        ok: true,
        start,
        end,
        perNumber: [],
        ensemble: [],
      });
    }

    const base = rounds[rounds.length - 1];

    const appearMap = buildAppearMap(rounds);
    const patternIndex = buildPatternRoundIndex(appearMap);

    // ✅ 기간 내 번호별 출현 횟수
    const appearCountMap = buildPerNumberCountInRange(appearMap, start, end);

    const perNumber = Array.from({ length: 45 }, (_, i) => {
      const num = i + 1;
      const latestPattern = getLatestIntervalPattern(appearMap, num);

      // ✅ 패턴 출현 횟수 (패턴 신뢰도)
      const patternSampleCount = latestPattern
        ? countPatternOccurrences(appearMap, num, latestPattern, start, end)
        : 0;

      return {
        num,
        latestPattern,
        appearCount: appearCountMap.get(num) ?? 0, // ✅ 추가
        patternSampleCount, // ✅ 의미 명확
        currentGap: getCurrentGap(appearMap, num, end),
        lastGap: getLastGap(appearMap, num, end),
      };
    });

    const ensembleMap = ensembleIntervalPatternNextFreq(rounds, base.numbers);

    /* -------------------------
     * 4️⃣ 다음 회차
     * ------------------------- */
    const checkNextRound = sortedLottoCache.find(
      (rec) => rec.drwNo === base.drwNo + 1
    );

    const nextRound = checkNextRound
      ? {
          round: checkNextRound.drwNo,
          numbers: extractNumbers(checkNextRound),
          bonus: Number(checkNextRound.bnusNo),
        }
      : null;

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
      nextRound,
    });
  } catch (err: any) {
    console.error(err);
    return res
      .status(500)
      .json({ ok: false, error: err.message || "internal error" });
  }
}
