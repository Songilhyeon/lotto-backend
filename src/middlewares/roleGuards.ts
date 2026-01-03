import { Response, NextFunction } from "express";
import { AuthRequest } from "./authMiddleware";

export function requirePremium(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const role = req.user?.role;
  if (role === "PREMIUM" || role === "ADMIN") return next();
  return res.status(403).json({ message: "Premium required" });
}

export function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  if (req.user?.role === "ADMIN") return next();
  return res.status(403).json({ message: "Admin only" });
}
