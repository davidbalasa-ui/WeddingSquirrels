import { prisma, prismaErrorCode } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const hasUrl = Boolean(process.env.DATABASE_URL);
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ ok: true, db: "up", hasDatabaseUrl: hasUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json(
      {
        ok: false,
        db: "down",
        hasDatabaseUrl: hasUrl,
        code: prismaErrorCode(error) || null,
        error: message.replace(/postgresql:\/\/[^@]+@/gi, "postgresql://***@").slice(0, 240),
      },
      { status: 503 },
    );
  }
}
