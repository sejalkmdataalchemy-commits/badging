# Platform Veteran Badge Auth Handoff

## Purpose

The `platform-veteran` edge function evaluates workers for veteran badge eligibility and, in `sync` mode, writes badge assignments to `public.worker_badges`.

This handoff document is meant for testing and integration with the client application.

## Endpoint

- Local: `http://localhost:8000`
- Deployed: `https://<project-ref>.functions.supabase.co/platform-veteran`

## Required Authentication Headers

Every non-`OPTIONS` request must include both headers below:

- `apikey: <anon key>`
- `Authorization: Bearer <access token>`

Also send:

- `Content-Type: application/json`

If `apikey` or `Authorization` is missing, the function returns `401`.

## Request Payload

The payload is optional. If you do not send a body, the function evaluates all available workers.

### JSON Structure

```json
{
  "mode": "preview",
  "worker_ids": ["worker-id-1", "worker-id-2"]
}
```

### Field Reference

- `mode`
  - `preview`: calculate eligibility only, do not write to `worker_badges`
  - `sync`: calculate eligibility and write earned badges to `worker_badges`
- `worker_ids`
  - optional array of worker ids to limit the run to specific workers
  - if omitted, all workers are processed

## Response Payload

### Success Example

```json
{
  "success": true,
  "mode": "preview",
  "processed_workers": 1,
  "eligible_workers": 1,
  "results": [
    {
      "worker_id": "1a44e832-1984-4bf5-91bb-6afd3262ded7",
      "worker_name": "aanya.sharma@dataalchemy.ai",
      "active_months": 6,
      "total_jobs_completed": 10,
      "badge_name": "Silver Veteran",
      "badge_tier": "Silver Veteran",
      "badge_slug": "platform-veteran-silver",
      "eligible": true
    }
  ]
}
```

### Response Fields

- `success`: boolean indicating whether the request succeeded
- `mode`: `preview` or `sync`
- `processed_workers`: number of workers evaluated
- `eligible_workers`: number of workers who qualified
- `results`: per-worker calculation details

### Per-Worker Result Fields

- `worker_id`: worker identifier from `public.workers.id`
- `worker_name`: resolved name from user or worker data
- `active_months`: calculated age in months
- `total_jobs_completed`: completed job count from `public.worker_performance`
- `badge_name`: badge display name when eligible
- `badge_tier`: badge tier when eligible
- `badge_slug`: stable badge slug when eligible
- `eligible`: whether the worker qualifies for a badge
- `reason`: present only when `eligible` is `false`

## Badge Calculation Rules

- `active_months` is calculated from `public.users.created_at`
- if `public.users.created_at` is missing, the function falls back to `public.workers.created_at`
- the worker must have `total_jobs_completed > 0`
- tier thresholds:
  - Bronze Veteran: 3 to 5 months
  - Silver Veteran: 6 to 11 months
  - Gold Veteran: 12 to 23 months
  - Platinum Veteran: 24 to 35 months
  - Diamond Veteran: 36+ months

## Database Tables Used

- `public.workers`
- `public.users`
- `public.worker_performance`
- `public.badges`
- `public.worker_badges`

## Testing Flow

### 1. Start locally

```powershell
deno run --allow-env --allow-net --allow-read --env-file=.env supabase/functions/platform-veteran/index.ts
```

### 2. Preview test

```json
{
  "mode": "preview",
  "worker_ids": ["1a44e832-1984-4bf5-91bb-6afd3262ded7"]
}
```

### 3. Sync test

```json
{
  "mode": "sync",
  "worker_ids": ["1a44e832-1984-4bf5-91bb-6afd3262ded7"]
}
```

## Notes for Client Integration

- Use `preview` first to validate badge calculation without writing to the database
- Use `sync` only after the response is verified
- The response is intentionally returned once in `results` to avoid duplicate fields
- Read badge details directly from the worker object in `results`

## Suggested Postman Setup

- Method: `POST`
- URL: local or deployed endpoint
- Headers:
  - `apikey`
  - `Authorization`
  - `Content-Type: application/json`
- Body: raw JSON using the payload examples above
