import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  user?: any;
}
export function authenticateJWT(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  // 헤더 또는 쿠키에서 JWT 가져오기
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : req.cookies?.token;

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    req.user = decoded; // req.user에 JWT payload 저장
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}
