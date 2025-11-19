import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function fetchLotto(round: number) {
  const res = await fetch(
    `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${round}`
  );
  const data = await res.json();
  if (data.returnValue !== "success") return null;
  return data;
}

async function main() {
  const lastRound = 1184; // 현재까지 회차
  for (let round = 11; round <= lastRound; round++) {
    try {
      const data = await fetchLotto(round);
      if (!data) continue;

      await prisma.lottoNumber.upsert({
        where: { drwNo: data.drwNo },
        update: {},
        create: {
          drwNo: data.drwNo,
          drwNoDate: new Date(data.drwNoDate),
          drwtNo1: data.drwtNo1,
          drwtNo2: data.drwtNo2,
          drwtNo3: data.drwtNo3,
          drwtNo4: data.drwtNo4,
          drwtNo5: data.drwtNo5,
          drwtNo6: data.drwtNo6,
          bnusNo: data.bnusNo,
          firstPrzwnerCo: data.firstPrzwnerCo.toString(),
          firstWinamnt: data.firstWinamnt.toString(),
          totSellamnt: data.totSellamnt.toString(),
          firstAccumamnt: data.firstAccumamnt.toString(),
        },
      });

      console.log(`Saved round ${round}`);
      await new Promise((r) => setTimeout(r, 500)); // 0.5초 지연
    } catch (err) {
      console.error(`Error at round ${round}`, err);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
