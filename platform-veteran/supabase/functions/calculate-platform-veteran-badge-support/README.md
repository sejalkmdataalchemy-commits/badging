# calculate-platform-veteran-badge

Supabase Edge Function to calculate and persist Platform Veteran Badges for Gig Platform workers.

## Deployment

Ensure the following environment variables are configured in your Supabase project:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY` (optional, used to validate incoming `apikey` header)

Deploy with:

```bash
supabase functions deploy calculate-platform-veteran-badge
```

## Local testing with .env

Create a `.env` file in `supabase/functions/calculate-platform-veteran-badge-support/` and fill in your values.

Example:

```env
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
SUPABASE_ANON_KEY=<your-anon-key>
TEST_AUTH_TOKEN=test-token
```

Run the local test harness with Deno:

```powershell
cd "c:\Users\Sejal Kumari\OneDrive - E-SOLUTIONS IT SERVICES PRIVATE LIMITED\Documents\badge\platform-veteran"
.\.deno\deno.exe run --allow-net --allow-env --allow-read supabase/functions/calculate-platform-veteran-badge-support/test-local.ts '{"worker_id":"<uuid>"}'
```

## Endpoint

POST `/functions/v1/calculate-platform-veteran-badge`

Headers:

- `Authorization: Bearer <TOKEN>`
- `apikey: <SUPABASE_ANON_KEY>`
- `Content-Type: application/json`

## Request Formats

Single worker calculation:

```json
{
  "worker_id": "<uuid>"
}
```

## Example cURL

Single worker:

```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"worker_id":"<uuid>"}' \
  https://<project>.supabase.co/functions/v1/calculate-platform-veteran-badge
```

## Notes

- The function uses UTC dates for active month calculation.
- The function preserves historical badge achievements by inserting a new badge record for each distinct badge code.
- Existing badge records are updated for the same level without creating duplicates.
- The function uses the existing `worker_badges` table schema and stores badge details in `badge_id` and `metadata`.
