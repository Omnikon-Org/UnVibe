import type { PrismaClient } from "@prisma/client";

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  avatar: string | null;
  score: number;
}

export async function getLeaderboard(prisma: PrismaClient, take = 20): Promise<LeaderboardEntry[]> {
  const scores = await prisma.iRSScore.findMany({
    include: { user: { select: { name: true, image: true } } },
    orderBy: { score: "desc" },
    take,
  });
  return scores.map((s, i) => ({
    rank: i + 1,
    userId: s.userId,
    name: s.user.name ?? "Anonymous",
    avatar: s.user.image,
    score: s.score,
  }));
}
