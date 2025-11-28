import { Router } from "express";
import { AuthRequest, auth } from "../middlewares/authMiddleware";
import { prisma } from "../app";
import jwt from "jsonwebtoken";

const router = Router();

router.post("/payment/complete", auth, async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ message: "Not logged in" });
  const userId = req.user.id;
  const amount = req.body.amount || 5900;

  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + 30); // 30일 구독

  // 1) Payment 기록 저장
  await prisma.payment.create({
    data: {
      userId,
      amount,
      status: "success",
      startDate: start,
      endDate: end,
    },
  });

  // 2) User를 PREMIUM으로 업데이트
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      role: "PREMIUM",
      subscriptionExpiresAt: end,
    },
  });

  // 3) JWT 갱신
  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ error: "JWT_SECRET not configured" });
  }

  const newToken = jwt.sign(
    {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role,
      subscriptionExpiresAt: updatedUser.subscriptionExpiresAt,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.cookie("token", newToken, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({ ok: true, role: "PREMIUM" });
});

export default router;
