# Tally Web — Time Tracker Dashboard

The web companion for [Tally - Time Tracker](https://github.com/geoClink/tally-ios) (iOS/watchOS/macOS app). Built with React + Supabase, sharing the same backend so data syncs across all platforms in real time.

**Live app:** https://tally-web-nu.vercel.app

---

## Features

- Live timer and manual session entry
- Dashboard with today's hours, weekly goal progress, and per-client goals
- Reports and charts broken down by client
- Session management with CSV export
- Invoice generation from tracked sessions
- Team workspaces with admin/member roles and team dashboard
- Cross-platform subscription sync (buy on iOS → unlocks on web, and vice versa)
- Voice control for the timer
- Dark mode following system preference
- Fully mobile responsive

## Pricing

| Plan | Price | Features |
|------|-------|----------|
| Free | $0 | 1 client, 7-day history |
| Pro | $9.99 one-time | Unlimited clients, full history, CSV export |
| Business | $4.99/month | Team workspaces, invoicing, all Pro features |

---

## Tech Stack

- **React 19** + **Vite**
- **Supabase JS** — database, auth, edge functions
- **Stripe** — web payments
- **Chart.js** + **react-chartjs-2** — reports charts
- **React Router v7** — navigation
- **Resend** (via Supabase Edge Function) — team invite emails

---

## Getting Started

```bash
npm install
cp .env.example .env
# Fill in your env vars (see below)
npm run dev
```

### Environment Variables

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_STRIPE_PUBLISHABLE_KEY=
VITE_STRIPE_PRO_LINK=
VITE_STRIPE_BUSINESS_LINK=
```

### Supabase Setup

Run `supabase/schema.sql` in your Supabase SQL editor to create the `subscriptions` table. See `supabase/ios-compatibility.md` for the full backend compatibility guide between iOS and web.

---

## iOS App

The iOS companion app (iPhone, Apple Watch, Mac via Catalyst) is available at:
👉 [github.com/geoClink/tally-ios](https://github.com/geoClink/tally-ios)

Both apps share the same Supabase project. Subscriptions, sessions, client rates, and team workspaces all sync in real time across platforms.

---

## Deployment

Deployed on [Vercel](https://vercel.com). Add the environment variables in Vercel project settings and connect your GitHub repo for automatic deploys on push.
