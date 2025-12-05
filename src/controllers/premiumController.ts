// premiumController.ts
import { Request, Response } from "express";
import {
  analyzePremiumRound,
  PremiumAnalysisResult,
} from "../lib/lottoAnalyzer";
import { initializePremiumCache, redis } from "../lib/premiumCache";

// ------------------------------
// 프리미엄 분석 API
// ------------------------------
export async function getPremiumAnalysis(req: Request, res: Response) {
  try {
    const round = Number(req.query.round);
    if (!round || round < 1) {
      return res
        .status(400)
        .json({ ok: false, error: "round required and must be >= 1" });
    }

    const bonusIncluded =
      req.query.bonusIncluded === "true" || req.query.bonusIncluded === "1";
    const recentCount = Number(req.query.recent) || 10; // 기본 최근 10회

    // 실제 분석 호출
    const result: PremiumAnalysisResult = await analyzePremiumRound(
      round,
      bonusIncluded,
      recentCount
    );

    // 프론트 최적화: 필요한 최소 데이터만 전달
    const optimized = {
      round: result.round,
      bonusIncluded: result.bonusIncluded,
      perNumberNextFreq: result.perNumberNextFreq,
      kMatchNextFreq: result.kMatchNextFreq,
      pattern10NextFreq: result.pattern10NextFreq,
      pattern7NextFreq: result.pattern7NextFreq,
      recentFreq: result.recentFreq, // 이미 recentCount 반영됨
      nextRound: result.nextRound,
      generatedAt: result.generatedAt,
    };

    res.json({ ok: true, data: optimized });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message || "internal error" });
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
    res.status(500).json({ ok: false, error: err.message || "internal error" });
  }
}
