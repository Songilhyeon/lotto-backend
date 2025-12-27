interface BuildNextRoundPreviewInput {
  start: number;
  end: number;
  minMatch: number;
  resultsCount: number;
  nextFrequency: Record<number, number>;
}

export function buildNextRoundPreviewSummary(
  input: BuildNextRoundPreviewInput
) {
  const { start, end, minMatch, resultsCount, nextFrequency } = input;

  const entries = Object.entries(nextFrequency)
    .map(([n, c]) => ({ number: Number(n), count: c }))
    .filter((v) => v.count > 0);

  const totalAppearances = entries.reduce((s, v) => s + v.count, 0);
  const avgFreq = totalAppearances / 45;
  const maxFreq = Math.max(...entries.map((v) => v.count));

  // -----------------------------
  // 🔥 판단 headline
  // -----------------------------
  let headline = "유사 패턴 이후, 번호 분포는 비교적 고르게 나타났습니다.";

  if (maxFreq >= avgFreq * 2) {
    headline =
      "유사 패턴 이후, 다음 회차에서 특정 번호 쏠림이 강하게 나타났습니다.";
  } else if (maxFreq >= avgFreq * 1.5) {
    headline =
      "유사 패턴 이후, 다음 회차에서 일부 번호의 반복 빈도가 높았습니다.";
  }

  // -----------------------------
  // 📌 signals 생성
  // -----------------------------
  const signals = [];

  if (maxFreq >= avgFreq * 2) {
    signals.push({
      id: "FREQ_SPIKE",
      label: "번호 쏠림",
      desc: "일부 번호가 평균 대비 2배 이상 자주 등장했습니다.",
      strength: "strong",
    });
  } else if (maxFreq >= avgFreq * 1.5) {
    signals.push({
      id: "FREQ_BIAS",
      label: "부분 집중",
      desc: "특정 번호에 출현 빈도가 다소 집중되었습니다.",
      strength: "normal",
    });
  } else {
    signals.push({
      id: "FREQ_BALANCE",
      label: "고른 분포",
      desc: "번호 출현이 비교적 고르게 분포되었습니다.",
      strength: "weak",
    });
  }

  if (resultsCount < 5) {
    signals.push({
      id: "LOW_SAMPLE",
      label: "표본 부족",
      desc: "유사 회차 수가 적어 해석 신뢰도가 낮을 수 있습니다.",
      strength: "weak",
    });
  }

  // -----------------------------
  // 🔢 highlight 번호 추출
  // -----------------------------
  const sorted = [...entries].sort((a, b) => b.count - a.count);

  const hot = sorted.slice(0, 5).map((v) => v.number);
  const watch = sorted
    .slice(5, 10)
    .filter((v) => v.count >= avgFreq)
    .map((v) => v.number);

  // -----------------------------
  // ✅ 최종 반환
  // -----------------------------
  return {
    basis: {
      start,
      end,
      minMatch,
      totalMatchedRounds: resultsCount,
    },
    headline,
    signals,
    highlight: {
      hot,
      watch,
    },
  };
}
