// premiumController.ts
import { Request, Response } from "express";
import { getRedis } from "../lib/redis"; // 경로는 실제 위치에 맞게
import {
  analyzePremiumRound,
  PremiumAnalysisResult,
} from "../lib/lottoAnalyzer";
import { initializePremiumCache } from "../lib/premiumCache";

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

    const includeBonus =
      req.query.includeBonus === "true" || req.query.includeBonus === "1";
    const recentCount = Number(req.query.recent) || 20; // 기본 최근 20회

    // 실제 분석 호출
    const result: PremiumAnalysisResult = await analyzePremiumRound(
      round,
      includeBonus,
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
    await getRedis().flushdb(); // 또는 분석용 key만 삭제
    initializePremiumCache();
    res.json({ ok: true, message: "Premium cache rebuilt" });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message || "internal error" });
  }
}
