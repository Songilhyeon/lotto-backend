import { Router, Request, Response } from "express";
import { AuthRequest, auth } from "../middlewares/authMiddleware";
import { prisma } from "../app";

const router = Router();

router.get("/", async (req, res) => {
  const posts = await prisma.post.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      createdAt: true,
      user: { select: { name: true } },
    },
  });

  res.json({ posts });
});

router.get("/:id", async (req, res) => {
  const post = await prisma.post.findUnique({
    where: { id: req.params.id },
    include: {
      user: { select: { name: true } },
      comments: {
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  res.json({ post });
});

router.post("/", auth, async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ message: "Not logged in" });
  const { title, content } = req.body;

  const post = await prisma.post.create({
    data: {
      title,
      content,
      userId: req.user.id,
    },
  });

  res.json({ ok: true, post });
});

router.post("/comments", auth, async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ message: "Not logged in" });
  const { postId, content } = req.body;

  const comment = await prisma.comment.create({
    data: {
      content,
      postId,
      userId: req.user.id,
    },
  });

  res.json({ ok: true, comment });
});

export default router;
