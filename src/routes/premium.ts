import { Router } from "express";
import {
  getPremiumAnalysis,
  rebuildPremiumCache,
} from "../controllers/premiumController";
import { getAiRecommendationController } from "../controllers/aiRecommendController";
import { getAiNextFreqRecommendation } from "../controllers/aiRecommendNextFreqController";
import {
  getAiRecommendationAdvanced,
  AiPresets,
} from "../lib/aiRecommenderAdvanced";

const router = Router();

router.get("/analysis", getPremiumAnalysis);
router.post("/rebuild-cache", rebuildPremiumCache);
router.get("/recommend", getAiRecommendationController);
router.get("/recommend-next", getAiNextFreqRecommendation);

// 🔹 기존 aiRecommenderAdvanced를 바로 호출
router.post("/recommend-advanced", async (req, res) => {
  try {
    const { round, presetName, clusterUnit, seed } = req.body;

    if (!round || typeof round !== "number") {
      return res.status(400).json({ error: "round는 필수 숫자입니다." });
    }

    const preset = AiPresets.find((p) => p.name === presetName);
    if (!preset)
      return res.status(400).json({ error: "유효하지 않은 preset입니다." });

    // 기존 aiRecommenderAdvanced 사용
    const result = await getAiRecommendationAdvanced(
      round,
      preset,
      clusterUnit,
      seed
    );

    res.json(result);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message || "서버 에러" });
  }
});

export default router;
