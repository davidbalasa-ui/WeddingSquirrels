# WeddingSquirrels

Mobile-first wedding planner for David & Haley (wedding day: **October 16, 2026**).

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Prisma + **Neon Postgres**
- PIN accounts (master `0425` administers visibility)
- Hosted on **Vercel**

## Setup

```bash
npm install
# Put Neon connection string + PIN_SESSION_SECRET in .env
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

## Deploy

1. Neon project → copy pooled `DATABASE_URL`
2. Vercel project linked to this GitHub repo
3. Env vars: `DATABASE_URL`, `PIN_SESSION_SECRET`
4. From your machine (Excel files available): `npx prisma db push && npm run db:seed` against Neon
5. Deploy / redeploy on Vercel

Keep the GitHub repo **private**.
