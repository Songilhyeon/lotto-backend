import { Router } from "express";
import { AuthRequest, auth } from "../middlewares/authMiddleware";
import { prisma } from "../app";
import sanitizeHtml from "sanitize-html";

const router = Router();

// ----------------------------------------
// sanitize 옵션 (필요하면 태그 허용 가능)
// ----------------------------------------
const clean = (value: string) =>
  sanitizeHtml(value, {
    allowedTags: [], // <b>, <i> 등 허용하려면 배열에 추가
    allowedAttributes: {},
  });

// ----------------------------------------
// 1) 게시글 목록 (페이지네이션)
// ----------------------------------------
router.get("/", async (req, res) => {
  const page = Math.max(parseInt(req.query.page as string) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

  const skip = (page - 1) * limit;

  const [posts, totalCount] = await Promise.all([
    prisma.post.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        title: true,
        content: true,
        createdAt: true,
        user: { select: { name: true } },
      },
    }),
    prisma.post.count(),
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  res.json({
    posts,
    page,
    totalPages,
    totalCount,
  });
});

// ----------------------------------------
// 2) 게시글 상세
// ----------------------------------------
router.get("/:id", async (req, res) => {
  const post = await prisma.post.findUnique({
    where: { id: req.params.id },
    include: {
      user: { select: { name: true, id: true } },
      comments: {
        include: { user: { select: { name: true, id: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  res.json({ post });
});

// ----------------------------------------
// 3) 게시글 생성
// ----------------------------------------
router.post("/", auth, async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ message: "Not logged in" });

  const { title, content } = req.body;

  const post = await prisma.post.create({
    data: {
      title: clean(title),
      content: clean(content),
      userId: req.user.id,
    },
  });

  res.json({ ok: true, post });
});

// ----------------------------------------
// 4) 게시글 수정
// ----------------------------------------
router.put("/:id", auth, async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ message: "Not logged in" });

  const post = await prisma.post.findUnique({
    where: { id: req.params.id },
  });

  if (!post) return res.status(404).json({ message: "Post not found" });
  if (post.userId !== req.user.id)
    return res.status(403).json({ message: "Not your post" });

  const { title, content } = req.body;

  const updated = await prisma.post.update({
    where: { id: req.params.id },
    data: {
      title: clean(title),
      content: clean(content),
    },
  });

  res.json({ ok: true, post: updated });
});

// ----------------------------------------
// 5) 게시글 삭제
// ----------------------------------------
router.delete("/:id", auth, async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ message: "Not logged in" });

  const post = await prisma.post.findUnique({
    where: { id: req.params.id },
  });

  if (!post) return res.status(404).json({ message: "Post not found" });
  if (post.userId !== req.user.id)
    return res.status(403).json({ message: "Not your post" });

  await prisma.post.delete({
    where: { id: req.params.id },
  });

  res.json({ ok: true });
});

// ----------------------------------------
// 6) 댓글 생성
// ----------------------------------------
router.post("/comments", auth, async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ message: "Not logged in" });

  const { postId, content } = req.body;

  const comment = await prisma.comment.create({
    data: {
      content: clean(content),
      postId,
      userId: req.user.id,
    },
  });

  res.json({ ok: true, comment });
});

// ----------------------------------------
// 7) 댓글 수정
// ----------------------------------------
router.put("/comments/:id", auth, async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ message: "Not logged in" });

  const comment = await prisma.comment.findUnique({
    where: { id: req.params.id },
  });

  if (!comment) return res.status(404).json({ message: "Comment not found" });
  if (comment.userId !== req.user.id)
    return res.status(403).json({ message: "Not your comment" });

  const { content } = req.body;

  const updated = await prisma.comment.update({
    where: { id: req.params.id },
    data: { content: clean(content) },
  });

  res.json({ ok: true, comment: updated });
});

// ----------------------------------------
// 8) 댓글 삭제
// ----------------------------------------
router.delete("/comments/:id", auth, async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ message: "Not logged in" });

  const comment = await prisma.comment.findUnique({
    where: { id: req.params.id },
  });

  if (!comment) return res.status(404).json({ message: "Comment not found" });
  if (comment.userId !== req.user.id)
    return res.status(403).json({ message: "Not your comment" });

  await prisma.comment.delete({
    where: { id: req.params.id },
  });

  res.json({ ok: true });
});

export default router;
