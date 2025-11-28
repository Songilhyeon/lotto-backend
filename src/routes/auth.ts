import { Router } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../app";
import { exchangeCodeForToken, getProfile, Provider } from "../utils/oauth";
import { normalizeProfile } from "../utils/normalizeProfile";
import { AuthRequest } from "../middlewares/authMiddleware";
import { auth } from "../middlewares/authMiddleware";

const router = Router();

interface OAuthUser {
  id: string;
  email: string | null;
  name: string | null;
  avatar: string | null;
  role?: string;
  subscriptionExpiresAt?: Date | null;
}

//-----------------------------------------------------------------------------
// 1) 테스트용 로그인 엔드포인트
//-----------------------------------------------------------------------------
router.post("/test-login", async (req, res) => {
  try {
    // 1) 이메일 테스트용 지정
    const email = "testuser@example.com";
    const name = "테스트 유저";

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1시간 후

    // 2) 유저 upsert (없으면 생성, 있으면 업데이트)
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name,
        role: "PREMIUM",
        subscriptionExpiresAt: expiresAt,
      },
      create: {
        email,
        name,
        role: "PREMIUM",
        subscriptionExpiresAt: expiresAt,
      },
    });

    // 3) JWT 발급
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

    // 4) 쿠키 세팅
    res.cookie("token", jwtToken, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      secure: process.env.COOKIE_SECURE === "true",
      sameSite: "lax",
    });

    res.json({ ok: true, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: "Test login failed" });
  }
});
//-----------------------------------------------------------------------------

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
    message: `로그인된 사용자 ${user.name} 입니다.`,
  });
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
router.get("/callback/:provider", async (req: AuthRequest, res) => {
  const provider = req.params.provider as Provider;
  const { code } = req.query;

  if (!code || typeof code !== "string")
    return res.status(400).send("Code is missing");

  try {
    // 1) 토큰 교환 → 프로필 가져오기
    const tokenRes = await exchangeCodeForToken(provider, code as string);
    const profile = await getProfile(provider, tokenRes.access_token);
    const normalized = normalizeProfile(profile);

    // 2) 유저 생성 or 조회
    if (!normalized.email) {
      return res.status(400).send("Email is required for login");
    }

    let user = await prisma.user.upsert({
      where: { email: normalized.email! },
      update: { name: normalized.name, avatar: normalized.avatar ?? null },
      create: {
        email: normalized.email!,
        name: normalized.name,
        avatar: normalized.avatar ?? null,
      },
    });

    // 3) Account 저장
    await prisma.account.upsert({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId: normalized.id,
        },
      },
      update: {
        accessToken: tokenRes.access_token,
      },
      create: {
        provider,
        providerAccountId: normalized.id,
        userId: user.id,
        accessToken: tokenRes.access_token,
      },
    });

    // 4) JWT 발급 (role 포함)
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
