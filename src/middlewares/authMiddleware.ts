import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../app";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email?: string;
    name?: string;
    role?: string;
    subscriptionExpiresAt?: string | Date;
  };
}

interface JwtPayload {
  id: string;
  email?: string;
  name?: string;
  role?: string;
  subscriptionExpiresAt?: string | Date;
  iat?: number;
  exp?: number;
}

export const auth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ message: "Not logged in" });

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not defined");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // DB에서 최신 상태 조회
    if (!decoded || typeof decoded !== "object" || !("id" in decoded)) {
      return res.status(401).json({ message: "Invalid token payload" });
    }

    const user = await prisma.user.findUnique({
      where: { id: (decoded as any).id },
    });

    if (!user) return res.status(401).json({ message: "Invalid user" });

    // 1) 구독 만료 체크
    if (
      user.role === "PREMIUM" &&
      user.subscriptionExpiresAt &&
      user.subscriptionExpiresAt < new Date()
    ) {
      // 만료 → FREE로 다운그레이드
      await prisma.user.update({
        where: { id: user.id },
        data: { role: "FREE", subscriptionExpiresAt: null },
      });
    }

    req.user = {
      id: user.id,
      email: user.email ?? undefined,
      name: user.name ?? undefined,
      role: user.role ?? undefined,
      subscriptionExpiresAt: user.subscriptionExpiresAt ?? undefined,
    };
    next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};
