// routes/lotto.ts
// ✅ 안전한 라우팅 순서로 정리 (고정 경로 -> 파라미터 경로)
// ✅ 외부 동행복권 API 호출 제거 (캐시/DB 조회 전용)

import { Router, Request, Response } from "express";
import { prisma } from "../app";
import { lottoCache, sortedLottoCache, toOptimized } from "../lib/lottoCache";

const router = Router();

/* ----------------------------------------
 * Helpers
 * ---------------------------------------- */
function isPositiveInt(n: number) {
  return Number.isInteger(n) && n > 0;
}

function upsertSortedCacheFromRecord(record: any) {
  // toOptimized(record)가 { drwNo: number, ... } 형태라고 가정
  const opt = toOptimized(record);
  const exists = sortedLottoCache.some((x) => x.drwNo === opt.drwNo);

  if (!exists) {
    sortedLottoCache.push(opt);
    sortedLottoCache.sort((a, b) => a.drwNo - b.drwNo);
  }
}

/* ----------------------------------------
 * GET /api/lotto/latest
 * - 고정 경로는 반드시 :round 보다 위에!
 * ---------------------------------------- */
router.get("/latest", async (_req: Request, res: Response) => {
  try {
    // 1) sorted cache가 있으면 최신 회차 drwNo 확보
    const lastOpt =
      sortedLottoCache.length > 0
        ? sortedLottoCache[sortedLottoCache.length - 1]
        : null;

    if (lastOpt?.drwNo) {
      // 캐시에 full record 없으면 DB에서 가져와 캐시 적재
      const cached = lottoCache.get(lastOpt.drwNo);
      if (cached) {
        return res.json({
          success: true,
          data: cached,
          message: "latest (cached)",
        });
      }

      const record = await prisma.lottoNumber.findUnique({
        where: { drwNo: lastOpt.drwNo },
      });

      if (record) {
        lottoCache.set(record.drwNo, record);
        return res.json({
          success: true,
          data: record,
          message: "latest (sorted cache)",
        });
      }
      // 혹시 sortedCache와 DB 불일치면 아래 DB fallback으로 진행
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
    upsertSortedCacheFromRecord(record);

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

/* ----------------------------------------
 * GET /api/lotto/:round
 * - 반드시 고정 경로들(/latest, /rounds 등) 아래에 둬야 안전
 * ---------------------------------------- */
router.get("/:round", async (req: Request, res: Response) => {
  const round = Number(req.params.round);

  if (!isPositiveInt(round)) {
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

    // 3) 캐시 적재 + sorted cache 보강
    lottoCache.set(round, record);
    upsertSortedCacheFromRecord(record);

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

export default router;
