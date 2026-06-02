# Tally iOS ↔ Web Compatibility Guide

The web app and iOS app share the same Supabase backend. This document covers everything iOS needs to stay in sync with the web.

---

## New Table: subscriptions

```sql
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  tier text not null check (tier in ('free', 'pro', 'business')),
  source text not null check (source in ('ios', 'stripe')),
  expires_at timestamptz,
  created_at timestamptz default now()
);
```

**iOS must:**
- Write a row after StoreKit confirms a purchase:
  - `tier`: `pro` or `business`
  - `source`: `ios`
  - `expires_at`: `null` for Pro (lifetime), renewal date for Business (monthly)
- Read this table on launch to check for web purchases (`source: stripe`) and unlock features accordingly
- Take the highest tier if multiple rows exist (e.g. user bought Pro on iOS and Business on web)

---

## Updated Table: config

Added column: `client_goals` (jsonb, default `[]`)

Format:
```json
[
  { "client": "Acme Corp", "weekly_hours": 20 },
  { "client": "WWDC Project", "weekly_hours": 10 }
]
```

**iOS must:**
- Read `client_goals` to show per-client weekly goal progress
- Write `client_goals` when the user sets or updates a client goal in the iOS app
- Use upsert with `onConflict: user_id` to avoid duplicate rows

---

## Updated Table: workspace_members

Added columns:
- `invited_email` (text) — email of the invited person
- `role` (text) — `member` or `admin`
- `accepted_at` (timestamptz) — set when the invite is accepted
- `user_id` (uuid) — set to `auth.uid()` when the invite is accepted

**iOS must:**
- When a user opens the app and their email matches an `invited_email` row, update that row:
  - Set `accepted_at` to current timestamp
  - Set `user_id` to `auth.currentUser.id`
- Admins can invite, remove, and change roles of members
- Members can only view the workspace

---

## Subscription Tier Logic

Both platforms should use the same logic:

1. Fetch all rows from `subscriptions` for the current user
2. Filter out expired rows (`expires_at < now()`)
3. Take the highest active tier: `business` > `pro` > `free`
4. Default to `free` if no rows exist

```swift
func highestTier(from subscriptions: [Subscription]) -> Tier {
    let active = subscriptions.filter { sub in
        guard let expiry = sub.expiresAt else { return true }
        return expiry > Date()
    }
    if active.contains(where: { $0.tier == "business" }) { return .business }
    if active.contains(where: { $0.tier == "pro" }) { return .pro }
    return .free
}
```

---

## Feature Gating

| Feature | Free | Pro | Business |
|---|---|---|---|
| Session history | 7 days | Full | Full |
| Clients | 1 | Unlimited | Unlimited |
| CSV export | No | Yes | Yes |
| Reports (all-time) | No | Yes | Yes |
| Team workspaces | No | No | Yes |
| Team dashboard | No | No | Yes |
| Invoice generation | No | No | Yes |

---

## Sessions Sync

Sessions sync automatically — no changes needed. Both platforms read/write to the same `sessions` table filtered by `user_id`.

---

## Web App URL

https://tally-web-nu.vercel.app
