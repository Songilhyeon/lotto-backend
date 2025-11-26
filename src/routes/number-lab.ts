import { Router, Request, Response } from "express";
import { LottoNumber, MatchResult } from "../types/lotto";
import { sortedLottoCache } from "../lib/lottoCache";

const router = Router();

router.post("/", (req: Request, res: Response) => {
  const { numbers } = req.body as { numbers?: number[] };

  if (!Array.isArray(numbers) || numbers.length === 0) {
    return res
      .status(400)
      .json({ success: false, message: "numbers 배열이 필요합니다." });
  }

  // normalize and dedupe
  const selectedSet = new Set(
    numbers.map((n) => Number(n)).filter((n) => !Number.isNaN(n))
  );
  const selected = Array.from(selectedSet);

  if (selected.length === 0) {
    return res
      .status(400)
      .json({ success: false, message: "유효한 번호가 필요합니다." });
  }

  // (A) 다음 회차 번호 빈도
  const frequencyNext: Record<number, number> = {} as Record<number, number>;
  for (let i = 1; i <= 45; i++) frequencyNext[i] = 0;

  // (B) 번호 개별 출현 회차 (1..45)
  const numberAppear: Record<number, number[]> = {} as Record<number, number[]>;
  for (let i = 1; i <= 45; i++) numberAppear[i] = [];

  // (C) 번호 일치 개수별 match 결과 (Map으로 수집)
  const grouped = new Map<number, MatchResult[]>();

  // (D) 선택 번호 기반 2~6 조합 미리 생성
  const allCombos: Record<number, number[][]> = {};
  const nums = selected;
  for (let k = 2; k <= 6; k++) {
    allCombos[k] = [];
    const helper = (start: number, combo: number[]) => {
      if (combo.length === k) {
        allCombos[k].push([...combo]);
        return;
      }
      for (let i = start; i < nums.length; i++) {
        combo.push(nums[i]);
        helper(i + 1, combo);
        combo.pop();
      }
    };
    helper(0, []);
  }

  // (E) 조합 등장 횟수 + 등장 회차 (map 형태)
  const comboCount: Record<
    number,
    Record<string, { count: number; rounds: number[] }>
  > = {};
  for (let k = 2; k <= 6; k++) comboCount[k] = {};

  // ============================================================
  //                      SINGLE PASS START
  // ============================================================
  for (let i = 0; i < sortedLottoCache.length; i++) {
    const draw = sortedLottoCache[i];
    const drawNumbers = [
      draw.drwtNo1,
      draw.drwtNo2,
      draw.drwtNo3,
      draw.drwtNo4,
      draw.drwtNo5,
      draw.drwtNo6,
    ];
    const drawSet = new Set(drawNumbers);

    // (1) 개별 번호 출현 회차 기록
    for (const n of drawNumbers) {
      numberAppear[n].push(draw.drwNo);
    }

    // (2) 선택 번호와의 matchCount 계산
    let matchCount = 0;
    for (const n of drawNumbers) {
      if (selectedSet.has(n)) matchCount++;
    }

    if (matchCount > 0) {
      // next draw
      const nextDraw = sortedLottoCache[i + 1];
      const nextNumbers = nextDraw
        ? [
            nextDraw.drwtNo1,
            nextDraw.drwtNo2,
            nextDraw.drwtNo3,
            nextDraw.drwtNo4,
            nextDraw.drwtNo5,
            nextDraw.drwtNo6,
          ]
        : [];

      for (const n of nextNumbers) frequencyNext[n]++;

      const matchRes: MatchResult = {
        round: draw.drwNo,
        numbers: drawNumbers,
        bonus: draw.bnusNo,
        matchCount,
        nextNumbers,
      };

      if (!grouped.has(matchCount)) grouped.set(matchCount, []);
      grouped.get(matchCount)!.push(matchRes);
    }

    // (3) 조합 카운트 + 등장 회차 저장
    for (let k = 2; k <= 6; k++) {
      for (const combo of allCombos[k]) {
        if (combo.every((n) => drawSet.has(n))) {
          const key = combo.join(",");
          if (!comboCount[k][key])
            comboCount[k][key] = { count: 0, rounds: [] };
          comboCount[k][key].count++;
          comboCount[k][key].rounds.push(draw.drwNo);
        }
      }
    }
  }
  // ============================================================
  //                      SINGLE PASS END
  // ============================================================

  // -------------------------
  // grouped 결과을 1..6 키로 보정 및 최신순 정렬
  // -------------------------
  const groupedResult: Record<number, MatchResult[]> = {};
  for (let k = 1; k <= 6; k++) {
    const arr = grouped.get(k) ?? [];
    groupedResult[k] = arr.sort((a, b) => b.round - a.round);
  }

  // 선택 번호만 필터링한 출현 정보
  const appearSelected: Record<number, number[]> = {};
  for (const s of selected) {
    appearSelected[s] = numberAppear[s] || [];
  }

  // (F) combos: 프런트에서 바로 쓰기 좋은 배열 형태로 변환
  // combosByK[k] = [{ combo: [a,b,...], count, rounds }, ...]
  const combosByK: Record<
    number,
    { combo: number[]; count: number; rounds: number[] }[]
  > = {};
  for (let k = 2; k <= 6; k++) {
    combosByK[k] = Object.entries(comboCount[k]).map(([key, v]) => ({
      combo: key.split(",").map((x) => Number(x)),
      count: v.count,
      rounds: v.rounds.slice().sort((a, b) => b - a),
    }));
    // 정렬: 빈도 내림차순, 동일 빈도면 최근 등장 순
    combosByK[k].sort((A, B) => {
      if (B.count !== A.count) return B.count - A.count;
      // 동일 카운트면 최신 등장 회차 비교
      const aLatest = A.rounds[0] ?? 0;
      const bLatest = B.rounds[0] ?? 0;
      return bLatest - aLatest;
    });
  }

  // (G) comboTop (k별 TOP 10) — 이미 있던 로직 유지
  const comboTop: Record<
    number,
    { key: string; count: number; rounds: number[] }[]
  > = {};

  for (let k = 2; k <= 6; k++) {
    comboTop[k] = Object.entries(comboCount[k])
      .map(([key, v]) => ({
        key,
        count: v.count,
        rounds: [...v.rounds].sort((a, b) => b - a),
      }))
      .sort((a, b) => b.count - a.count);
    // .slice(0, 10);
  }
  // ---------------------------------------------
  // 🔥 combos[k]에서 count = 0 항목 제거 (안전 처리)
  // ---------------------------------------------
  const combosFiltered: Record<
    number,
    Record<string, { count: number; rounds: number[] }>
  > = {};

  for (let k = 2; k <= 6; k++) {
    combosFiltered[k] = {};

    for (const [key, v] of Object.entries(comboCount[k])) {
      if (v.count > 0) {
        combosFiltered[k][key] = v;
      }
    }
  }

  // -------------------------
  // 응답 (하위 호환성 및 사용 편의성 보장)
  // -------------------------
  return res.json({
    success: true,
    selectedNumbers: selected,

    // primary structure for newest front-end
    matchGroups: groupedResult, // {1: [...], 2: [...], ...}

    // backward-compatible alias (some older UIs expect `results`)
    results: groupedResult,

    // per-number appearances for just selected numbers
    appear: appearSelected,

    frequencyNext,

    // combos: both a map-like raw structure and a convenient array form for UI
    combosMap: comboCount, // raw map: combosMap[k]["a,b"] = {count, rounds}
    combos: combosFiltered, // convenient: combos[k] = [{combo: number[], count, rounds}, ...]

    comboTop,
  });
});

export default router;
