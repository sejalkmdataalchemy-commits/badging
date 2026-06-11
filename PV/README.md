# Platform Veteran Edge Function

This function evaluates workers for the Platform Veteran badge tiers and, in `sync` mode, writes earned badges to `public.worker_badges`.

## Endpoint

- Local: `http://localhost:8000`
- Deployed: `https://<project-ref>.functions.supabase.co/platform-veteran`

## Required Headers

Send both headers for every non-`OPTIONS` request:

- `apikey: <anon key>`
- `Authorization: Bearer <access token>`
- `Content-Type: application/json`

If either `apikey` or `Authorization` is missing, the function returns `401`.

## Request Body

The body is optional. If omitted, the function processes all workers it can find.

### JSON Shape

```json
{
  "mode": "preview",
  "worker_ids": ["worker-id-1", "worker-id-2"]
}
```

### Keys

- `mode`:
  - `preview` = calculate results only, do not write badge assignments
  - `sync` = calculate results and write earned badges to `public.worker_badges`
- `worker_ids`:
  - optional array of worker ids to limit the run to specific workers
  - if omitted, the function processes all workers

## Response Shape

### Success Response

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

- `success`: boolean status of the run
- `mode`: `preview` or `sync`
- `processed_workers`: number of workers evaluated
- `eligible_workers`: number of workers that qualified for a badge
- `results`: array of per-worker evaluation objects

### Per-Worker Result Fields

- `worker_id`: worker identifier from `public.workers.id`
- `worker_name`: display name resolved from user or worker data
- `active_months`: computed age in months
- `total_jobs_completed`: value from `public.worker_performance.total_jobs_completed`
- `badge_name`: badge display name when eligible
- `badge_tier`: badge tier when eligible
- `badge_slug`: stable badge slug when eligible
- `eligible`: whether the worker qualifies for a badge
- `reason`: present only when `eligible` is `false`

## Data Sources

The function reads from these tables:

- `public.workers`
- `public.users`
- `public.worker_performance`
- `public.badges`
- `public.worker_badges`

## Badge Logic

- `active_months` is calculated from `public.users.created_at`
- if `public.users.created_at` is missing, the function falls back to `public.workers.created_at`
- a worker must have `total_jobs_completed > 0`
- qualifying tiers:
  - Bronze Veteran: 3 to 5 months
  - Silver Veteran: 6 to 11 months
  - Gold Veteran: 12 to 23 months
  - Platinum Veteran: 24 to 35 months
  - Diamond Veteran: 36+ months

## Testing Examples

### Preview only

```json
{
  "mode": "preview",
  "worker_ids": ["1a44e832-1984-4bf5-91bb-6afd3262ded7"]
}
```

### Sync and write badge assignment

```json
{
  "mode": "sync",
  "worker_ids": ["1a44e832-1984-4bf5-91bb-6afd3262ded7"]
}
```

## Notes for Integration

- Use `preview` first during client testing
- Switch to `sync` only when the output is verified
- Do not rely on duplicate summary fields; the function now returns a single `results` array
- The client should read badge details from the worker result object directly