import { Router } from "express";
import { auth } from "../middlewares/authMiddleware";
import { requireAdmin } from "../middlewares/roleGuards";
import { publicRecommendLimiter } from "../middlewares/rateLimiters";
import {
  getPremiumAnalysisController,
  rebuildPremiumCache,
} from "../controllers/premiumController";
import { getAiRecommendationController } from "../controllers/aiRecommendController";
import { getAiRecommendNextFreqController } from "../controllers/aiRecommendNextFreqController";
import { getAiRecommenderAdvancedController } from "../controllers/aiRecommenderAdvancedController";
import { getAiRecommenderVariantController } from "../controllers/aiRecommenderVariantController";
import { analyzeIntervalController } from "../controllers/analyzeIntervalController";
import { analyzeRoundPatternController } from "../controllers/analyzeRoundPatternController";
import { getPremiumNextFreqController } from "../controllers/premiumNextFreqController";

const router = Router();

// ✅ 1) 무료/공개 (로그인 불필요) — 먼저 선언
router.get("/recommend", publicRecommendLimiter, getAiRecommendationController);
router.get(
  "/recommend-next",
  publicRecommendLimiter,
  getAiRecommendNextFreqController
);

// ✅ 2) 그 외는 로그인 필요 — 여기서부터 auth 적용
router.use(auth);

router.get("/analysis", getPremiumAnalysisController);
router.post("/recommend-advanced", getAiRecommenderAdvancedController);
router.post("/recommend-variant", getAiRecommenderVariantController);
router.get("/analysis/interval", analyzeIntervalController);
router.get("/analysis/round-dist", analyzeRoundPatternController);
router.get("/analysis/advanced", getPremiumNextFreqController);
router.post("/analysis/advanced", getPremiumNextFreqController);

// ✅ 3) 위험 작업은 관리자만
router.post("/rebuild-cache", requireAdmin, rebuildPremiumCache);

export default router;

// import { Router } from "express";
// import { auth } from "../middlewares/authMiddleware";
// import { requireAdmin, requirePremium } from "../middlewares/roleGuards";
// import {
//   getPremiumAnalysis,
//   rebuildPremiumCache,
// } from "../controllers/premiumController";
// import { getAiRecommendationController } from "../controllers/aiRecommendController";
// import { getAiRecommendNextFreqController } from "../controllers/aiRecommendNextFreqController";
// import { getAiRecommenderAdvancedController } from "../controllers/aiRecommenderAdvancedController";
// import { getAiRecommenderVariantController } from "../controllers/aiRecommenderVariantController";
// import { analyzeIntervalController } from "../controllers/analyzeIntervalController";
// import { analyzeRoundPatternController } from "../controllers/analyzeRoundPatternController";

// const router = Router();

// // ✅ 로그인 필수
// router.use(auth);

// // ✅ 프리미엄 기능 잠금
// router.get("/analysis", requirePremium, getPremiumAnalysis);
// router.get("/recommend", requirePremium, getAiRecommendationController);
// router.get("/recommend-next", requirePremium, getAiRecommendNextFreqController);
// router.post("/recommend-advanced", requirePremium, getAiRecommenderAdvancedController);
// router.post("/recommend-variant", requirePremium, getAiRecommenderVariantController);
// router.get("/analysis/interval", requirePremium, analyzeIntervalController);
// router.get("/analysis/round-dist", requirePremium, analyzeRoundPatternController);

// // ✅ 캐시 리빌드는 ADMIN만
// router.post("/rebuild-cache", requireAdmin, rebuildPremiumCache);

// export default router;
