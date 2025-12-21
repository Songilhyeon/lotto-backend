interface BuildSummaryParams {
  start: number;
  end: number;
  minMatch: number;
  resultsCount: number;
  nextFrequency: Record<number, number>;
}

export function buildNextRoundPreviewSummary(params: BuildSummaryParams) {
  const { start, end, minMatch, resultsCount, nextFrequency } = params;

  // -----------------------------
  // 1️⃣ 빈도 정렬
  // -----------------------------
  const freqList = Object.entries(nextFrequency)
    .map(([num, count]) => ({ num: Number(num), count }))
    .filter((v) => v.count > 0)
    .sort((a, b) => b.count - a.count);

  const hot = freqList.slice(0, 3).map((v) => v.num);
  const watch = freqList.slice(-3).map((v) => v.num);

  // -----------------------------
  // 2️⃣ 시그널 구성
  // -----------------------------
  const signals = [];

  if (resultsCount > 0) {
    signals.push({
      id: "transition",
      label: "유사 회차 기반 분석",
      desc: `번호가 ${minMatch}개 이상 일치한 ${resultsCount}개 과거 회차의 다음 결과를 분석했습니다.`,
    });
  }

  if (hot.length > 0) {
    signals.push({
      id: "frequency",
      label: "다음 회차 빈도 집중",
      desc: `다음 회차에서 ${hot.join(
        ", "
      )} 번호의 출현 빈도가 상대적으로 높았습니다.`,
    });
  }

  signals.push({
    id: "range",
    label: "패턴 관찰 필요",
    desc: "다음 회차 번호 분포에서 특정 패턴이 관찰됩니다.",
  });

  return {
    basis: {
      start,
      end,
      minMatch,
      totalMatchedRounds: resultsCount,
    },
    signals,
    highlight: {
      hot,
      watch,
    },
  };
}
