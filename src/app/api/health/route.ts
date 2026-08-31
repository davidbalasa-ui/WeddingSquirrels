import { databaseTransport, prisma, prismaErrorCode } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const hasUrl = Boolean(process.env.DATABASE_URL);
  try {
    await prisma.pinAccount.count();
    return Response.json({
      ok: true,
      db: "up",
      hasDatabaseUrl: hasUrl,
      transport: databaseTransport,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        db: "down",
        hasDatabaseUrl: hasUrl,
        transport: databaseTransport,
        code: prismaErrorCode(error) || null,
        error: "Database unavailable",
      },
      { status: 503 },
    );
  }
}
