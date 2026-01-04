import { Router, Request, Response } from "express";
import { prisma } from "../app";
import { lottoCache, sortedLottoCache, toOptimized } from "../lib/lottoCache";

const router = Router();

/**
 * GET /api/lotto/:round
 * - 캐시 → DB 조회만 수행 (외부 동행복권 API 호출 제거)
 */
router.get("/:round", async (req: Request, res: Response) => {
  const round = Number(req.params.round);

  if (!Number.isFinite(round) || round <= 0) {
    return res.status(400).json({
      success: false,
      error: "INVALID_ROUND",
      message: "회차 번호가 잘못되었습니다.",
    });
  }

  // 1) 메모리 캐시
  const cached = lottoCache.get(round);
  if (cached) {
    return res.json({ success: true, data: cached, message: "cached data" });
  }

  try {
    // 2) DB 조회
    const record = await prisma.lottoNumber.findUnique({
      where: { drwNo: round },
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        error: "ROUND_NOT_FOUND",
        message: `${round}회차 데이터가 존재하지 않습니다.`,
      });
    }

    // 3) 캐시 적재
    lottoCache.set(round, record);

    // 4) sorted cache 갱신(안전하게 중복 방지)
    //    - toOptimized가 drwNo를 포함한다고 가정
    const opt = toOptimized(record);
    const exists = sortedLottoCache.some((x) => x.drwNo === opt.drwNo);

    if (!exists) {
      sortedLottoCache.push(opt);
      sortedLottoCache.sort((a, b) => a.drwNo - b.drwNo);
    }

    return res.json({
      success: true,
      data: record,
      message: "database data",
    });
  } catch (err) {
    console.error("SERVER Error:", err);
    return res.status(500).json({
      success: false,
      error: "SERVER_ERROR",
      message: "서버 오류가 발생했습니다.",
    });
  }
});

/**
 * (옵션) GET /api/lotto/latest
 * - 프론트에서 최신회차 확인용으로 쓰면 UX 좋아짐
 */
router.get("/latest", async (_req: Request, res: Response) => {
  try {
    // 1) sorted cache에 있으면 최우선
    const last = sortedLottoCache.length
      ? sortedLottoCache[sortedLottoCache.length - 1]
      : null;

    if (last) {
      // last가 optimized 형태라면, 원본 레코드도 바로 주고 싶을 수 있음
      // 여기서는 가볍게 drwNo만으로 DB 조회해서 full record 반환
      const record = await prisma.lottoNumber.findUnique({
        where: { drwNo: last.drwNo },
      });

      if (record) {
        lottoCache.set(record.drwNo, record);
        return res.json({
          success: true,
          data: record,
          message: "latest (sorted cache)",
        });
      }
    }

    // 2) fallback: DB에서 최신 회차 1개
    const record = await prisma.lottoNumber.findFirst({
      orderBy: { drwNo: "desc" },
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        error: "NO_DATA",
        message: "저장된 로또 데이터가 없습니다.",
      });
    }

    lottoCache.set(record.drwNo, record);

    // sorted cache도 채워두기
    const opt = toOptimized(record);
    const exists = sortedLottoCache.some((x) => x.drwNo === opt.drwNo);
    if (!exists) {
      sortedLottoCache.push(opt);
      sortedLottoCache.sort((a, b) => a.drwNo - b.drwNo);
    }

    return res.json({
      success: true,
      data: record,
      message: "latest (db)",
    });
  } catch (err) {
    console.error("SERVER Error:", err);
    return res.status(500).json({
      success: false,
      error: "SERVER_ERROR",
      message: "서버 오류가 발생했습니다.",
    });
  }
});

export default router;
