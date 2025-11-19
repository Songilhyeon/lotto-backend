import { Router, Request, Response } from "express";
import { LottoNumber } from "../types/lotto";
import { ApiResponse } from "../types/api";
import { prisma } from "../app";

const router = Router();

// 동행복권 API URL 생성
const getLottoAPI = (round: string | number) =>
  `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${round}`;

// GET /api/lotto/:round
router.get("/:round", async (req: Request, res: Response) => {
  const round = Number(req.params.round);
  if (!round || round <= 0) {
    return res.status(400).json({
      success: false,
      error: "INVALID_ROUND",
      message: "회차 번호가 잘못되었습니다.",
    } satisfies ApiResponse<null>);
  }

  try {
    // DB 조회
    const record = await prisma.lottoNumber.findUnique({
      where: { drwNo: round },
    });

    if (record) {
      return res.json({
        success: true,
        data: record,
      } satisfies ApiResponse<LottoNumber>);
    }

    // API 요청
    const apiUrl = getLottoAPI(round);
    const response = await fetch(apiUrl);
    const apiData = await response.json();

    // ❗ 에러 처리: returnValue 가 fail이면 존재하지 않는 회차
    if (apiData.returnValue !== "success") {
      return res.status(404).json({
        success: false,
        error: "ROUND_NOT_FOUND",
        message: `${round}회차는 아직 발표되지 않았습니다.`,
      } satisfies ApiResponse<null>);
    }

    const saved = await prisma.lottoNumber.create({
      data: {
        drwNo: apiData.drwNo,
        drwNoDate: new Date(apiData.drwNoDate),
        drwtNo1: apiData.drwtNo1,
        drwtNo2: apiData.drwtNo2,
        drwtNo3: apiData.drwtNo3,
        drwtNo4: apiData.drwtNo4,
        drwtNo5: apiData.drwtNo5,
        drwtNo6: apiData.drwtNo6,
        bnusNo: apiData.bnusNo,
        firstPrzwnerCo: apiData.firstPrzwnerCo.toString(),
        firstWinamnt: apiData.firstWinamnt.toString(),
        totSellamnt: apiData.totSellamnt.toString(),
        firstAccumamnt: apiData.firstAccumamnt.toString(),
      },
    });

    return res.json({
      success: true,
      data: saved,
    } satisfies ApiResponse<LottoNumber>);
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      error: "SERVER_ERROR",
      message: "서버 오류가 발생했습니다.",
    } satisfies ApiResponse<null>);
  }
});

export default router;
