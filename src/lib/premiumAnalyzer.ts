// premiumAnalyzer.ts (Bitmask 최적화 + 정확한 패턴 기반 다음 회차)
// -------------------------------
// 전체 설명
// -------------------------------
// 이 파일은 로또(1..45 번호)를 비트마스크 방식으로 표현하여
// 빠른 집합 연산과 다음 회차 빈도 분석을 수행합니다.
// 주요 아이디어:
// - 각 회차의 번호들을 BigInt 비트마스크(mask)로 표현 (번호 n -> 1n << BigInt(n - 1))
// - mask끼리 AND 연산으로 교집합(공통 번호 개수)을 빠르게 계산
// - 과거의 동일한 '버킷 패턴' (예: 10개 단위 분포)이 나왔을 때 그 다음 회차의 출현 빈도를 집계

import { getPremiumRound, getPremiumRange, BASE } from "./premiumCache";

export interface PremiumAnalysisResult {
  round: number;
  bonusIncluded: boolean;
  // 번호별 다음 회차 빈도: perNumberNextFreq[trackedNumber][m] = "trackedNumber가 과거 회차에 존재했을 때 다음 회차에 m번이 나온 횟수"
  perNumberNextFreq: Record<number, Record<number, number>>;
  // kMatchNextFreq[k][m] = 'target 회차와 과거 회차의 교집합(k 개일 때)에서 다음 회차에 번호 m이 나온 빈도'
  kMatchNextFreq: Record<"1" | "2" | "3" | "4+", Record<number, number>>;
  // 단위별(버킷 패턴) 다음 회차 빈도
  pattern10NextFreq: Record<number, number>;
  pattern7NextFreq: Record<number, number>;
  pattern5NextFreq: Record<number, number>;
  // 최근 N회 빈도
  recentFreq: Record<number, number>;
  // 이미 존재하는 다음 회차 정보(있다면)
  nextRound: NextRoundObj | null;
  generatedAt: string;
  oddEvenNextFreq: {
    odd: number;
    even: number;
    ratio: number; // odd / (odd + even)
  };
  lastAppearance: Record<number, number>;
  consecutiveAppearances: Record<number, number>; // 최근 연속 출현 횟수
}

type NextRoundObj = {
  round: number;
  numbers: number[];
  bonus?: number | null;
};

// -----------------------------------------------------
// 기본 설정: BASE
// -----------------------------------------------------
// BASE는 번호를 비트마스크 또는 버킷에 매핑할 때 기준이 되는 값입니다.
// BASE = 1 → 번호 1이 비트 위치 0에 대응 (로또 1..45에 가장 자연스러움)
// BASE = 0 → 번호 0이 비트 위치 0에 대응 (외부 데이터가 0-based일 때만 사용)
// 대부분의 실제 로또 데이터는 1..45이므로 BASE=1을 권장합니다.

// ----------------------------------
// 숫자 유효성 검사 (입력 체크 통합)
// ----------------------------------
function isValidNumber(n: number): boolean {
  if (!Number.isInteger(n)) return false;
  return BASE === 1 ? n >= 1 && n <= 45 : n >= 0 && n <= 44;
}

// Bitmask popcount
// ----------------------------------
// BigInt에 저장된 1비트(설정된 비트)의 개수를 센다.
// 알고리즘: Brian Kernighan 알고리즘을 사용하여 x에서 가장 낮은 1비트를 하나씩 지워가며 카운트.
function popcount(x: bigint): number {
  let c = 0n;
  // x가 0이 될 때까지 반복
  while (x) {
    x &= x - 1n; // 가장 낮은 1비트를 제거
    c++;
  }
  // 결과는 number로 반환 (비트 수가 아주 큰 경우에는 주의 필요)
  return Number(c);
}

// 두 비트마스크의 교집합(동시에 1인 비트)의 개수를 반환
function inter(a: bigint, b: bigint): number {
  return popcount(a & b);
}

// ----------------------------------
// 배열 → Record 변환
// ----------------------------------
// 내부적으로는 1..45 범위의 키를 가진 객체를 생성한다.
// 주의: 이 함수는 arr[1]이 '번호 1'의 값이라고 가정한다(1-based 인덱싱).
function arrToRecord(arr: number[]): Record<number, number> {
  // BASE=1 → key: 1~45
  // BASE=0 → key: 0~44
  const start = BASE;
  const end = BASE === 1 ? 45 : 44;
  const obj: Record<number, number> = {};
  for (let i = start; i <= end; i++) obj[i] = arr[i] ?? 0;
  return obj;
}
// ----------------------------------
// 숫자 배열을 단위(unitSize)별로 버킷으로 나누기
// ----------------------------------
// 예: unitSize = 10이면 [1..10], [11..20], ... 식으로 나뉘어 각 구간에 몇 개의 번호가 들어있는지 반환
function patternBuckets(numbers: number[], unitSize: number): number[] {
  const maxVal = BASE === 1 ? 45 : 44;
  const bucketCount = Math.ceil((maxVal + 1) / unitSize);
  const buckets = Array(bucketCount).fill(0);

  for (const n of numbers) {
    if (!isValidNumber(n)) continue;
    const idx = Math.floor((n - BASE) / unitSize);
    if (idx >= 0 && idx < bucketCount) buckets[idx]++;
  }
  return buckets;
}

// ----------------------------------
// 버킷 배열을 문자열 키로 변환
// ----------------------------------
// 예: [3,1,1,0,1] -> "3-1-1-0-1"
// 이 문자열을 Map key로 사용하면 패턴 일치 검색이 쉬워진다.
function patternKey(buckets: number[]): string {
  return buckets.join("-");
}

// ----------------------------------
// 패턴 다음 회차 빈도 계산
// ----------------------------------
// unitSize: 버킷 크기
// rounds: 과거 회차 데이터 배열 (getPremiumRange의 반환값 형태를 따름)
// targetNumbers: 분석 대상(타겟 회차)의 번호 목록
// bonusIncluded: 보너스를 포함해서 마스크를 사용할지 여부
// 반환값: index 1..45에 대해 해당 번호의 다음 회차 출현 횟수
function computePatternNext(
  unitSize: number,
  rounds: ReturnType<typeof getPremiumRange>,
  targetNumbers: number[],
  bonusIncluded: boolean
): number[] {
  const freq = Array(46).fill(0); // 0 인덱스는 사용 안함 (1..45)
  // 타겟 회차의 버킷 패턴(key)
  const keyBuckets = patternBuckets(targetNumbers, unitSize);
  const key = patternKey(keyBuckets);

  for (const r of rounds) {
    // 과거 회차 r의 버킷 패턴
    const rBuckets = patternBuckets(r.numbers, unitSize);
    // 패턴이 다르면 건너뜀
    if (patternKey(rBuckets) !== key) continue;

    // 패턴이 일치하면 그 다음 회차를 확인
    const nextRound = getPremiumRound(r.drwNo + 1);
    if (!nextRound) continue; // 다음 회차가 존재하지 않으면 건너뜀

    // 다음 회차에서 보너스를 포함할지 마스크 선택
    const nextMask = bonusIncluded ? nextRound.bonusMask : nextRound.mask;

    // 다음 회차의 모든 번호 m(1..45)에 대해 출현 여부를 카운트
    for (let m = 1; m <= 45; m++) {
      // 비트 포지션 규칙: 번호 m은 (1n << BigInt(m - BASE))로 매핑됩니다.
      // (BASE = 1 이면 1 -> shift 0, BASE = 0 이면 0 -> shift 0)
      const shift = BigInt(m - BASE);
      if ((nextMask & (1n << shift)) !== 0n) freq[m]++;
    }
  }

  return freq;
}

// 홀짝 카운트
function countOddEven(numbers: number[]) {
  let odd = 0;
  let even = 0;

  for (const n of numbers) {
    if (!isValidNumber(n)) continue;
    if (n % 2 === 0) even++;
    else odd++;
  }

  return { odd, even };
}

// ----------------------------------
// 분석 메인
// ----------------------------------
export async function analyzePremiumRound(
  round: number,
  bonusIncluded: boolean,
  recentCount: number
): Promise<PremiumAnalysisResult> {
  if (!Number.isInteger(round) || round < 1)
    throw new Error("round는 1 이상의 정수여야 합니다.");
  if (!Number.isInteger(recentCount) || recentCount < 1)
    throw new Error("recentCount는 1 이상의 정수여야 합니다.");

  const target = getPremiumRound(round);
  if (!target) throw new Error(`해당 회차(${round}) 데이터 없음`);

  // 타겟 회차의 마스크 (보너스 포함 여부에 따라 선택)
  const targetMask = bonusIncluded ? target.bonusMask : target.mask;

  // 과거 모든 회차(1..round-1)를 가져옴
  const rounds = getPremiumRange(1, round - 1);

  // lastAppearance 계산 (전체 회차 검색)
  const lastAppearanceMap: Record<number, number> = {};
  for (let n = 1; n <= 45; n++) {
    lastAppearanceMap[n] = 0;
  }

  for (let searchRound = round; searchRound >= 1; searchRound--) {
    const r = getPremiumRound(searchRound);
    if (!r) continue;

    const mask = bonusIncluded ? r.bonusMask : r.mask;

    for (let n = 1; n <= 45; n++) {
      if (lastAppearanceMap[n] !== 0) continue;

      const shift = BigInt(n - BASE);
      if ((mask & (1n << shift)) !== 0n) {
        lastAppearanceMap[n] = searchRound;
      }
    }

    // 모든 번호를 찾았으면 조기 종료
    const allFound = Object.values(lastAppearanceMap).every((v) => v !== 0);
    if (allFound) break;
  }

  // consecutiveAppearances 계산 (끊김 추적)
  const consecutiveMap: Record<number, number> = {};
  const isBroken: Record<number, boolean> = {};

  for (let n = 1; n <= 45; n++) {
    consecutiveMap[n] = 0;
    isBroken[n] = false;
  }

  for (let n = 1; n <= 45; n++) {
    let currentStreak = 0;
    let maxStreak = 0;

    for (let searchRound = round; searchRound >= 1; searchRound--) {
      const r = getPremiumRound(searchRound);
      if (!r) break;

      const mask = r.mask;
      const shift = BigInt(n - BASE);

      if ((mask & (1n << shift)) !== 0n) {
        currentStreak++;
        if (currentStreak === 2) maxStreak++;
      } else {
        currentStreak = 0; // 끊기면 streak 리셋
      }
    }

    consecutiveMap[n] = maxStreak; // 최대 streak 혹은 최근 streak 선택 가능
  }

  // -----------------------------------
  // perNumberNextFreq 초기화
  // -----------------------------------
  const perNumberNextFreq: Record<number, Record<number, number>> = {};
  // 분석 대상 번호(선택된 6개 + 필요시 보너스 포함)
  const numbersToTrack = target.numbers.concat(
    bonusIncluded && target.bonus ? [target.bonus] : []
  );

  // 추적 번호들의 출현 빈도 테이블 미리 생성
  for (const n of numbersToTrack) {
    if (!isValidNumber(n)) continue;
    const freq: Record<number, number> = {};
    for (let i = 1; i <= 45; i++) freq[i] = 0;
    perNumberNextFreq[n] = freq;
  }

  // -----------------------------------------------------
  // K-match 초기화
  // -----------------------------------------------------
  const kMatchNext = {
    "1": Array(46).fill(0),
    "2": Array(46).fill(0),
    "3": Array(46).fill(0),
    "4+": Array(46).fill(0),
  };

  // -----------------------------------
  // 메인 루프: 과거 회차를 하나씩 훑음
  // -----------------------------------
  for (const r of rounds) {
    // 타겟 회차와 과거 회차 r의 공통 번호 개수(k), 교집합 크기
    const rMask = bonusIncluded ? r.bonusMask : r.mask;
    const kMatch = inter(targetMask, rMask);

    // 과거 회차 r의 다음 회차(데이터)는 다음 회차의 마스크를 이용해 분석
    const next = getPremiumRound(r.drwNo + 1);
    if (!next) continue;
    const nextMask = bonusIncluded ? next.bonusMask : next.mask;

    // 선택된 번호(및 보너스)의 '다음 회차 빈도'를 perNumberNextFreq에 누적
    for (const tn of numbersToTrack) {
      if (!isValidNumber(tn)) continue;
      // 이 과거 회차 r에 우리가 추적하는 n이 포함되어 있었는지 검사
      const shiftT = BigInt(tn - BASE);
      const inCurrent = (rMask & (1n << shiftT)) !== 0n;

      if (!inCurrent) continue; // 해당 번호가 과거 회차 r에 없으면 건너뜀

      // 다음 회차의 모든 번호 m에 대해 출현 여부를 카운트
      for (let m = 1; m <= 45; m++) {
        const shift = BigInt(m - BASE);
        if ((nextMask & (1n << shift)) !== 0n) perNumberNextFreq[tn][m]++;
      }
    }

    // K-match(공통 개수)에 따른 다음 회차 빈도 누적
    for (let m = 1; m <= 45; m++) {
      const shift = BigInt(m - BASE);
      if ((nextMask & (1n << shift)) === 0n) continue;

      if (kMatch >= 4) kMatchNext["4+"][m]++;
      else if (kMatch === 3) kMatchNext["3"][m]++;
      else if (kMatch === 2) kMatchNext["2"][m]++;
      else if (kMatch === 1) kMatchNext["1"][m]++;
    }
  }

  // -----------------------------------
  // 패턴 다음 회차 빈도 (버킷 크기별)
  // -----------------------------------
  const pattern10Next = computePatternNext(
    10,
    rounds,
    target.numbers,
    bonusIncluded
  );
  const pattern7Next = computePatternNext(
    7,
    rounds,
    target.numbers,
    bonusIncluded
  );
  const pattern5Next = computePatternNext(
    5,
    rounds,
    target.numbers,
    bonusIncluded
  );

  // -----------------------------------
  // 최근 N회 빈도 계산
  // -----------------------------------
  const recentFreqArr = Array(46).fill(0);
  const recentStart = Math.max(1, round - recentCount + 1);
  const recentRounds = getPremiumRange(recentStart, round);

  for (const r of recentRounds) {
    const mask = bonusIncluded ? r.bonusMask : r.mask;
    for (let n = 1; n <= 45; n++) {
      const shift = BigInt(n - BASE);
      if ((mask & (1n << shift)) !== 0n) recentFreqArr[n]++;
    }
  }

  /// -----------------------------------
  // 다음 회차 정보(있다면) 가져오기
  // -----------------------------------
  const nextObj = getPremiumRound(round + 1);
  const nextRoundWithBonus = nextObj
    ? {
        round: nextObj.drwNo,
        numbers: nextObj.numbers,
        bonus: nextObj.bonus,
      }
    : null;

  // -----------------------------------
  // 홀짝 패턴 기반 다음 회차 빈도
  // -----------------------------------
  const targetOddEven = countOddEven(target.numbers);

  let oddNext = 0;
  let evenNext = 0;
  let matchedCount = 0;

  for (const r of rounds) {
    const rOddEven = countOddEven(r.numbers);

    // 홀짝 패턴이 동일한 경우만
    if (
      rOddEven.odd === targetOddEven.odd &&
      rOddEven.even === targetOddEven.even
    ) {
      const next = getPremiumRound(r.drwNo + 1);
      if (!next) continue;

      const nextOE = countOddEven(next.numbers);
      oddNext += nextOE.odd;
      evenNext += nextOE.even;
      matchedCount++;
    }
  }

  const oddEvenNextFreq = {
    odd: oddNext,
    even: evenNext,
    ratio: oddNext + evenNext > 0 ? oddNext / (oddNext + evenNext) : 0,
  };

  // -----------------------------------
  // 결과 반환: 필요한 구조에 맞추어 형변환
  // -----------------------------------
  return {
    round,
    bonusIncluded,
    perNumberNextFreq,
    kMatchNextFreq: {
      "1": arrToRecord(kMatchNext["1"]),
      "2": arrToRecord(kMatchNext["2"]),
      "3": arrToRecord(kMatchNext["3"]),
      "4+": arrToRecord(kMatchNext["4+"]),
    },
    pattern10NextFreq: arrToRecord(pattern10Next),
    pattern7NextFreq: arrToRecord(pattern7Next),
    pattern5NextFreq: arrToRecord(pattern5Next),
    recentFreq: arrToRecord(recentFreqArr),
    oddEvenNextFreq,
    nextRound: nextRoundWithBonus,
    generatedAt: new Date().toISOString(),
    lastAppearance: lastAppearanceMap,
    consecutiveAppearances: consecutiveMap,
  };
}
