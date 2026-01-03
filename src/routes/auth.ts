// routes/auth.ts
import { Router } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../app";
import { exchangeCodeForToken, getProfile, Provider } from "../utils/oauth";
import { normalizeProfile } from "../utils/normalizeProfile";
import { AuthRequest, auth } from "../middlewares/authMiddleware";

const router = Router();

const JWT_EXPIRES_IN = 7 * 24 * 60 * 60 * 1000; // 7일
const isProd = process.env.NODE_ENV === "production";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

//-------------------------------------------
// 쿠키 설정 helper
//-------------------------------------------
const setTokenCookie = (res: any, token: string) => {
  res.cookie("token", token, {
    httpOnly: true,
    secure: isProd, // 배포(HTTPS)만 true
    sameSite: isProd ? "none" : "lax", // cross-site 허용
    maxAge: JWT_EXPIRES_IN,
  });
};

//-------------------------------------------
// 로그인된 사용자 확인
//-------------------------------------------
router.get("/me", auth, (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ message: "Not logged in" });
  const user = req.user;
  res.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      subscriptionExpiresAt: user.subscriptionExpiresAt,
    },
  });
});

//-------------------------------------------
// 로그아웃
//-------------------------------------------
router.post("/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
  });
  res.json({ ok: true, message: "Logged out" });
});

//-------------------------------------------
// OAuth callback 처리
//-------------------------------------------
router.get("/callback/:provider", async (req: AuthRequest, res) => {
  const provider = req.params.provider as Provider;
  const { code, state } = req.query;

  if (!code || typeof code !== "string")
    return res.status(400).send("Code missing");

  try {
    const tokenRes = await exchangeCodeForToken(provider, code);
    const profile = await getProfile(provider, tokenRes.access_token);
    const normalized = normalizeProfile(profile);

    const userEmail =
      normalized.email || `${provider}-${normalized.id}@${provider}-temp.local`;

    if (!normalized.email) normalized.email = userEmail;

    const user = await prisma.user.upsert({
      where: { email: normalized.email! },
      update: { name: normalized.name, avatar: normalized.avatar ?? null },
      create: {
        email: normalized.email!,
        name: normalized.name,
        avatar: normalized.avatar ?? null,
      },
    });

    await prisma.account.upsert({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId: normalized.id,
        },
      },
      update: { accessToken: tokenRes.access_token },
      create: {
        provider,
        providerAccountId: normalized.id,
        userId: user.id,
        accessToken: tokenRes.access_token,
      },
    });

    const jwtToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        subscriptionExpiresAt: user.subscriptionExpiresAt,
      },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    );

    setTokenCookie(res, jwtToken);

    // 항상 새로운 state 또는 프론트 URL 사용
    // const redirectUrl =
    //   typeof state === "string" ? decodeURIComponent(state) : FRONTEND_URL;
    // res.redirect(redirectUrl);

    // 지금 백엔드는 state를 “리다이렉트 URL”로 쓰고 있어서 위험해.
    // 가장 쉬운 즉시 안전조치는: callback에서 state 무시하고 무조건 FRONTEND_URL로 보내는 것.
    res.redirect(FRONTEND_URL);
  } catch (err) {
    console.error(err);
    res.status(500).send("OAuth callback error");
  }
});

//-------------------------------------------
// OAuth 로그인 URL 생성
//-------------------------------------------
router.get("/:provider", (req, res) => {
  const provider = req.params.provider as Provider;

  // 항상 새로운 state 전달 (프런트 redirect URL)
  const state =
    typeof req.query.state === "string"
      ? encodeURIComponent(req.query.state)
      : encodeURIComponent(FRONTEND_URL);

  let url = "";
  switch (provider) {
    case "google":
      url =
        `https://accounts.google.com/o/oauth2/v2/auth` +
        `?client_id=${process.env.GOOGLE_CLIENT_ID}` +
        `&redirect_uri=${process.env.GOOGLE_REDIRECT_URI}` +
        `&response_type=code` +
        `&scope=openid email profile` +
        `&state=${state}`;
      break;

    case "naver":
      const redirect = encodeURIComponent(process.env.NAVER_REDIRECT_URI!);
      url =
        `https://nid.naver.com/oauth2.0/authorize` +
        `?client_id=${process.env.NAVER_CLIENT_ID}` +
        `&redirect_uri=${redirect}` +
        `&response_type=code` +
        `&state=${state}`;
      break;

    case "kakao":
      url =
        `https://kauth.kakao.com/oauth/authorize` +
        `?client_id=${process.env.KAKAO_CLIENT_ID}` +
        `&redirect_uri=${process.env.KAKAO_REDIRECT_URI}` +
        `&response_type=code` +
        `&state=${state}`;
      break;

    default:
      return res.status(400).send("Unknown provider");
  }

  res.redirect(url);
});

export default router;
