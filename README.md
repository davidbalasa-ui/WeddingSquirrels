# WeddingSquirrels

Mobile-first wedding planner for David & Haley (wedding day: **October 16, 2026**).

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Prisma + SQLite locally (swap to **Neon Postgres** for Vercel production)
- PIN accounts (master `0425` administers visibility)

## Local setup

```bash
npm install
npx prisma db push
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### PINs (seeded)

| PIN  | Account         | Access                                      |
|------|-----------------|---------------------------------------------|
| 0425 | Master          | Everything + Accounts admin                 |
| 0999 | Mother in law   | Shelly tasks only · no budget/guests/day-of |

Excel seed sources (from your Downloads folder):

- `Wedding Master TO-DO.xlsx`
- `Finances.xlsx`
- `Wedding Timeline.xlsx`
- `Guest Addresses.xlsx`

## Production (Vercel + Neon)

1. Create a Neon Postgres database and copy `DATABASE_URL`
2. Change `prisma/schema.prisma` datasource `provider` to `postgresql`
3. Set Vercel env vars: `DATABASE_URL`, `PIN_SESSION_SECRET`
4. Deploy the GitHub repo; run `prisma db push` + `npm run db:seed` against Neon (or a migrate step in CI)

Keep the GitHub repo **private** once guest addresses are in any remote seed path.
