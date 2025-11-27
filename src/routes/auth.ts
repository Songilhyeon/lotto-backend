import { Router } from "express";
import jwt from "jsonwebtoken";
import { exchangeCodeForToken, getProfile, Provider } from "../utils/oauth";
import { normalizeProfile } from "../utils/normalizeProfile";
import { authenticateJWT, AuthRequest } from "../middlewares/authMiddleware";

const router = Router();

/**
 * 로그인한 사용자만 접근 가능한 protected API
 */
router.get("/protected", authenticateJWT, (req: AuthRequest, res) => {
  const user = req.user;
  res.json({ message: `Hello ${user?.name}`, user });
});

// routes/auth.ts
router.post("/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "lax",
  });
  res.json({ message: "Logged out" });
});

/**
 * OAuth callback 처리
 */
router.get("/callback/:provider", async (req, res) => {
  const provider = req.params.provider as Provider;
  const { code } = req.query;

  if (!code || typeof code !== "string")
    return res.status(400).send("Code is missing");

  try {
    const tokenRes = await exchangeCodeForToken(provider, code);
    const profile = await getProfile(provider, tokenRes.access_token);
    const user = normalizeProfile(profile);

    const jwtToken = jwt.sign(user, process.env.JWT_SECRET!, {
      expiresIn: "7d",
    });

    res.cookie("token", jwtToken, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      secure: process.env.COOKIE_SECURE === "true",
      sameSite: "lax",
    });

    res.redirect("http://localhost:3000"); // 프런트로 리다이렉트
  } catch (err) {
    console.error(err);
    res.status(500).send("OAuth callback error");
  }
});

/**
 * OAuth 로그인 URL 생성
 * - catch-all 역할을 하므로 맨 마지막에 위치
 */
router.get("/:provider", (req, res) => {
  const provider = req.params.provider as Provider;
  let url = "";

  switch (provider) {
    case "google":
      url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${process.env.GOOGLE_REDIRECT_URI}&response_type=code&scope=openid email profile`;
      break;
    case "naver":
      url = `https://nid.naver.com/oauth2.0/authorize?client_id=${process.env.NAVER_CLIENT_ID}&redirect_uri=${process.env.NAVER_REDIRECT_URI}&response_type=code&state=STATE_STRING`;
      break;
    case "kakao":
      url = `https://kauth.kakao.com/oauth/authorize?client_id=${process.env.KAKAO_CLIENT_ID}&redirect_uri=${process.env.KAKAO_REDIRECT_URI}&response_type=code`;
      break;
    default:
      return res.status(400).send("Unknown provider");
  }

  res.redirect(url);
});

export default router;
