# Dependency Versions — Village Finance

Recorded after Phase 0 Foundation bootstrap.

## Core Framework

| Package | Version | Notes |
|---|---|---|
| next | 16.4.5 | Fixed — strict requirement |
| react | 19.3.0 | Compatible default for Next 16.4.5 |
| react-dom | 19.3.0 | Compatible default for Next 16.4.5 |

## Supabase

| Package | Version | Notes |
|---|---|---|
| @supabase/supabase-js | 2.118.0 | Supabase JS client |
| @supabase/ssr | 0.12.7 | Cookie-based SSR for Next.js 16 |

## Database / ORM

| Package | Version | Notes |
|---|---|---|
| prisma | 7.10.1 | Migration authority; uses `prisma.config.js` |
| @prisma/client | 7.10.1 | Same exact version as prisma |

## Media / Uploads

| Package | Version | Notes |
|---|---|---|
| cloudinary | 2.11.0 | v2 SDK for signed server-side uploads |
| next-cloudinary | 7.0.0 | UI helper components |

## Domain & UI Utilities

| Package | Version | Notes |
|---|---|---|
| tailwindcss | 4.3.4 | Tailwind CSS v4 |
| recharts | 3.10.1 | Financial charts |
| lucide-react | 1.68.0 | Icons |
| date-fns | 4.4.0 | Date arithmetic |
| zod | 4.6.7 | Input & schema validation |
| dexie | 4.4.7 | IndexedDB for offline PWA |

## Developer Tooling

| Package | Version | Notes |
|---|---|---|
| eslint | 9.39.5 | Flat config |
| eslint-config-next | 16.4.5 | ESLint rule set for Next 16.4.5 |
