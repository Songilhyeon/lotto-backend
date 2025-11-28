import { Router } from "express";
import { sortedLottoCache } from "../lib/lottoCache";

const router = Router();

type LottoRound = {
  drwNo: number;
  drwtNo1: number;
  drwtNo2: number;
  drwtNo3: number;
  drwtNo4: number;
  drwtNo5: number;
  drwtNo6: number;
};

const getNumbers = (round: LottoRound) => [
  round.drwtNo1,
  round.drwtNo2,
  round.drwtNo3,
  round.drwtNo4,
  round.drwtNo5,
  round.drwtNo6,
];

// GET /api/lotto/pattern?lookback=100&topK=10&minConsec=2
router.get("/", (req, res) => {
  const lookback = Number(req.query.lookback) || 100;
  const topK = Number(req.query.topK) || 10;
  const minConsec = Number(req.query.minConsec) || 2;

  if (!sortedLottoCache || sortedLottoCache.length === 0) {
    return res.json({
      consecutive: [],
      coldNumbers: [],
      message: "No data available",
    });
  }

  const rounds = [...sortedLottoCache]
    .sort((a, b) => b.drwNo - a.drwNo)
    .slice(0, lookback);

  // ---------- 연속 번호 분석 ----------
  const consecutiveMap = new Map<
    string,
    { seq: number[]; count: number; lastRounds: number[] }
  >();

  for (const r of rounds) {
    const nums = getNumbers(r).sort((a, b) => a - b);
    for (let start = 1; start <= 45; start++) {
      for (let L = minConsec; L <= 6; L++) {
        if (start + L - 1 > 45) break;
        let ok = true;
        for (let k = 0; k < L; k++) {
          if (!nums.includes(start + k)) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
        const seq = Array.from({ length: L }, (_, i) => start + i);
        const key = seq.join("-");
        const prev = consecutiveMap.get(key);
        if (prev) {
          prev.count += 1;
          prev.lastRounds.push(r.drwNo);
        } else {
          consecutiveMap.set(key, { seq, count: 1, lastRounds: [r.drwNo] });
        }
      }
    }
  }

  const consecutive = Array.from(consecutiveMap.values())
    .sort((a, b) => b.count - a.count || a.seq.length - b.seq.length)
    .slice(0, topK);

  // ---------- 장기 미출현 번호 ----------
  const lastSeen = new Array<number | null>(46).fill(null); // index 0 unused
  for (const r of rounds) {
    for (const n of getNumbers(r)) {
      if (lastSeen[n] === null) lastSeen[n] = r.drwNo;
    }
  }

  const latestRound = rounds[0].drwNo;
  const coldNumbers = [];
  for (let n = 1; n <= 45; n++) {
    const ls = lastSeen[n];
    const gap = ls == null ? Number.MAX_SAFE_INTEGER : latestRound - ls;
    coldNumbers.push({
      num: n,
      lastSeen: ls,
      gapRounds: ls == null ? null : gap,
    });
  }

  coldNumbers.sort((a, b) => (b.gapRounds ?? 0) - (a.gapRounds ?? 0));

  res.json({
    consecutive,
    coldNumbers: coldNumbers.slice(0, topK),
    message: "Pattern data",
  });
});

export default router;
