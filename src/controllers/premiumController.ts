// premiumController.ts (bitmask 버전 최종본)

import { Request, Response } from "express";
import {
  analyzePremiumRound,
  PremiumAnalysisResult,
} from "../lib/premiumAnalyzer";
import { initializePremiumCache, redis } from "../lib/premiumCache";

// ------------------------------
// 프리미엄 분석 API
// ------------------------------
export async function getPremiumAnalysis(req: Request, res: Response) {
  try {
    const round = Number(req.query.round);
    if (isNaN(round) || round < 1) {
      return res.status(400).json({
        ok: false,
        error: "round must be a number >= 1",
      });
    }

    const bonusIncluded =
      req.query.bonusIncluded === "true" || req.query.bonusIncluded === "1";

    const recentCount = Number(req.query.recent) || 10;

    // 실행
    const result: PremiumAnalysisResult = await analyzePremiumRound(
      round,
      bonusIncluded,
      recentCount
    );

    const optimized = {
      round: result.round,
      bonusIncluded: result.bonusIncluded,
      perNumberNextFreq: result.perNumberNextFreq,
      kMatchNextFreq: result.kMatchNextFreq,
      pattern10NextFreq: result.pattern10NextFreq,
      pattern7NextFreq: result.pattern7NextFreq,
      pattern5NextFreq: result.pattern5NextFreq,
      recentFreq: result.recentFreq,
      nextRound: result.nextRound,
      generatedAt: result.generatedAt,
    };

    res.json({ ok: true, data: optimized });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({
      ok: false,
      error: err.message || "internal error",
    });
  }
}

// ------------------------------
// 프리미엄 캐시 재빌드 API
// ------------------------------
export async function rebuildPremiumCache(req: Request, res: Response) {
  try {
    await redis.flushdb();
    initializePremiumCache();
    res.json({ ok: true, message: "Premium cache rebuilt" });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({
      ok: false,
      error: err.message || "internal error",
    });
  }
}
