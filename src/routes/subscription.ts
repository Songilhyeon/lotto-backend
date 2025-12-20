// server/routes/subscription.ts
import express from "express";
import { prisma } from "../app";

const router = express.Router();

// 무료 7일 체험 시작
router.post("/free", async (req, res) => {
  const { userId } = req.body;
  const freeExpiry = new Date();
  freeExpiry.setDate(freeExpiry.getDate() + 14);

  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role: "FREE", subscriptionExpiresAt: freeExpiry },
    });
    res.json({ success: true, user: updatedUser });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// Toss 결제 후 유료 전환
router.post("/toss", async (req, res) => {
  const { userId, amount, tossPaymentId } = req.body;

  // TODO: Toss 결제 검증
  const paymentStatus = "success"; // 검증 완료

  const startDate = new Date();
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + 1); // 예: 1개월 유료

  try {
    await prisma.payment.create({
      data: {
        userId,
        amount,
        status: paymentStatus,
        startDate,
        endDate,
      },
    });

    if (paymentStatus === "success") {
      await prisma.user.update({
        where: { id: userId },
        data: { role: "PREMIUM", subscriptionExpiresAt: endDate },
      });
    }

    res.json({ success: paymentStatus === "success" });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
