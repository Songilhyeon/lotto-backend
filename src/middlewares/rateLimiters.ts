import rateLimit from "express-rate-limit";

/**
 * 공개 엔드포인트용 기본 레이트 리미터
 * - IP 기준
 * - 1분에 10회 (필요하면 조절)
 */
export const publicRecommendLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." },
});
