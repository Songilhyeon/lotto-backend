import { Request, Response } from "express";
import { getPremiumLatestRound, getPremiumRange } from "../lib/premiumCache";
import {
  buildDistPattern,
  findSimilarDistPatterns,
  predictNextNumbers,
  predictNextPattern,
} from "../lib/roundDistPattern";
import { sortedLottoCache } from "../lib/lottoCache";
import { extractNumbers } from "../utils/lottoNumberUtils";

/**
 * GET /api/analyze/round-pattern
 *
 * Query Parameters:
 * - round: 분석할 회차 (기본값: 최신 회차)
 * - minSimilarity: 최소 유사도 0~1 (기본값: 0.7)
 * - topN: 반환할 최대 매칭 수 (기본값: 10)
 * - method: bucket | exact | hybrid (기본값: hybrid)
 *
 * Response:
 * {
 *   ok: true,
 *   targetRound: 1150,
 *   pattern: {
 *     numbers: [7, 13, 21, 28, 35, 42],
 *     gaps: [6, 8, 7, 7, 7],
 *     buckets: ["M", "M", "M", "M", "M"],
 *     bucketDist: { S: 0, M: 5, L: 0, XL: 0 },
 *     patternStr: "M-M-M-M-M"
 *   },
 *   similarMatches: [
 *     {
 *       matchedRound: 1023,
 *       similarity: 0.92,
 *       matchedPattern: "M-M-M-M-M",
 *       nextRound: 1024,
 *       nextNumbers: [5, 11, 19, 27, 33, 40]
 *     }
 *   ],
 *   prediction: {
 *     numbers: [
 *       { num: 7, score: 0.95 },
 *       { num: 13, score: 0.87 }
 *     ],
 *     patterns: [
 *       { pattern: "S-M-M-M-L", probability: 0.35 },
 *       { pattern: "M-S-M-M-M", probability: 0.28 }
 *     ]
 *   }
 * }
 */
export async function analyzeRoundPatternController(
  req: Request,
  res: Response
) {
  try {
    const latest = getPremiumLatestRound();
    const targetRound = Number(req.query.round ?? latest);
    const minSimilarity = Number(req.query.minSimilarity ?? 0.7);
    const topN = Number(req.query.topN ?? 10);
    const method = (req.query.method as any) ?? "hybrid";

    if (
      Number.isNaN(targetRound) ||
      Number.isNaN(minSimilarity) ||
      Number.isNaN(topN)
    ) {
      return res.status(400).json({ ok: false, error: "invalid parameters" });
    }

    if (minSimilarity < 0 || minSimilarity > 1) {
      return res
        .status(400)
        .json({ ok: false, error: "minSimilarity must be 0~1" });
    }

    if (!["bucket", "exact", "hybrid"].includes(method)) {
      return res
        .status(400)
        .json({ ok: false, error: "method must be bucket|exact|hybrid" });
    }

    // 전체 데이터 로드
    const rounds = getPremiumRange(1, latest);

    // 대상 회차 찾기
    const target = rounds.find((r) => r.drwNo === targetRound);
    if (!target) {
      return res
        .status(404)
        .json({ ok: false, error: "target round not found" });
    }

    /* -------------------------
     * 4️⃣ 다음 회차
     * ------------------------- */
    const checkNextRound = sortedLottoCache.find(
      (rec) => rec.drwNo === targetRound + 1
    );

    const nextRound = checkNextRound
      ? {
          round: checkNextRound.drwNo,
          numbers: extractNumbers(checkNextRound),
          bonus: Number(checkNextRound.bnusNo),
        }
      : null;

    // 패턴 분석
    const pattern = buildDistPattern(target);

    // 유사 패턴 검색
    const result = findSimilarDistPatterns(
      rounds,
      targetRound,
      minSimilarity,
      topN,
      method
    );

    if (!result || result.matches.length === 0) {
      return res.json({
        ok: true,
        targetRound,
        pattern: {
          numbers: pattern.numbers,
          gaps: pattern.gaps,
          buckets: pattern.buckets,
          bucketDist: pattern.bucketDist,
          gapStats: pattern.gapStats,
          patternStr: pattern.patternStr,
        },
        similarMatches: [],
        prediction: {
          numbers: [],
          patterns: [],
        },
        nextRound,
      });
    }

    // 다음 회차 예측
    const numberScores = predictNextNumbers(result);
    const patternProbs = predictNextPattern(result);

    return res.json({
      ok: true,
      targetRound,
      pattern: {
        numbers: pattern.numbers,
        gaps: pattern.gaps,
        buckets: pattern.buckets,
        bucketDist: pattern.bucketDist,
        gapStats: pattern.gapStats,
        patternStr: pattern.patternStr,
      },
      similarMatches: result.matches.map((m) => {
        const matchedRound = rounds.find((r) => r.drwNo === m.matchedRound)!;
        const matchedPattern = buildDistPattern(matchedRound);

        return {
          matchedRound: m.matchedRound,
          matchedNumbers: matchedRound.numbers,
          matchedGaps: matchedPattern.gaps,
          matchedPattern: matchedPattern.patternStr,
          similarity: m.similarity,
          nextRound: m.nextRound,
          nextNumbers: m.nextNumbers,
        };
      }),
      prediction: {
        numbers: [...numberScores.entries()]
          .map(([num, score]) => ({ num, score }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 20),
        patterns: [...patternProbs.entries()]
          .map(([pattern, prob]) => ({ pattern, probability: prob }))
          .sort((a, b) => b.probability - a.probability)
          .slice(0, 10),
      },
      nextRound,
    });
  } catch (err: any) {
    console.error(err);
    return res
      .status(500)
      .json({ ok: false, error: err.message || "internal error" });
  }
}
