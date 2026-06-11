import { createClient } from "npm:@supabase/supabase-js@2";

type VeteranBadgeDefinition = {
  badgeTier: string;
  badgeSlug: string;
  minMonths: number;
  maxMonths: number | null;
  displayOrder: number;
};

type WorkerRow = {
  id: string;
  user_id: string | null;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  email: string | null;
  created_at: string | null;
};

type UserRow = {
  id: string;
  full_name: string | null;
  created_at: string | null;
};

type PerformanceRow = {
  worker_id: string;
  total_jobs_completed: number | null;
};

type WorkerResult = {
  worker_id: string;
  worker_name: string;
  active_months: number;
  total_jobs_completed: number;
  badge_name: string | null;
  badge_tier: string | null;
  badge_slug: string | null;
  eligible: boolean;
  reason?: string;
};

type BadgeRow = {
  id: string;
  badge_name: string;
};

type BadgeDefinitionRow = {
  badge_name: string;
  description: string;
  criteria: {
    category: string;
    min_months: number;
    max_months: number | null;
    min_jobs_completed: number;
    badge_slug: string;
  };
  is_active: boolean;
  display_order: number;
  metadata: {
    badge_slug: string;
    category: string;
    active: boolean;
  };
};

type WorkerBadgeInsertRow = {
  worker_id: string;
  badge_id: string;
  metadata: {
    badge_tier: string | null;
    badge_slug: string | null;
    active_months: number;
    total_jobs_completed: number;
    source: string;
  };
};

type RequestMode = "sync" | "preview";

type VeteranRequestBody = {
  mode?: RequestMode;
  worker_ids?: string[];
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const POSTGREST_IN_CLAUSE_BATCH_SIZE = 100;

const VETERAN_BADGES: VeteranBadgeDefinition[] = [
  { badgeTier: "Bronze Veteran", badgeSlug: "platform-veteran-bronze", minMonths: 3, maxMonths: 5, displayOrder: 1 },
  { badgeTier: "Silver Veteran", badgeSlug: "platform-veteran-silver", minMonths: 6, maxMonths: 11, displayOrder: 2 },
  { badgeTier: "Gold Veteran", badgeSlug: "platform-veteran-gold", minMonths: 12, maxMonths: 23, displayOrder: 3 },
  { badgeTier: "Platinum Veteran", badgeSlug: "platform-veteran-platinum", minMonths: 24, maxMonths: 35, displayOrder: 4 },
  { badgeTier: "Diamond Veteran", badgeSlug: "platform-veteran-diamond", minMonths: 36, maxMonths: null, displayOrder: 5 },
];

function calculateMonths(createdAt: string | Date | null): number {
  if (!createdAt) {
    return 0;
  }

  const start = createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (Number.isNaN(start.getTime())) {
    return 0;
  }

  const now = new Date();
  let months = (now.getUTCFullYear() - start.getUTCFullYear()) * 12 + (now.getUTCMonth() - start.getUTCMonth());

  if (now.getUTCDate() < start.getUTCDate()) {
    months -= 1;
  }

  return Math.max(0, months);
}

function getVeteranTier(months: number): VeteranBadgeDefinition | null {
  return VETERAN_BADGES.find((badge) => {
    const withinLowerBound = months >= badge.minMonths;
    const withinUpperBound = badge.maxMonths === null || months <= badge.maxMonths;
    return withinLowerBound && withinUpperBound;
  }) ?? null;
}

function normalizeWorkerName(worker: WorkerRow, user: UserRow | null): string {
  const candidates = [
    user?.full_name,
    worker.display_name,
    [worker.first_name, worker.last_name].filter(Boolean).join(" "),
    worker.email,
  ];

  return candidates.find((value) => typeof value === "string" && value.trim().length > 0)?.trim() ?? "Unknown Worker";
}

function buildSupabaseClient(): any {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function chunkArray<T>(values: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) {
    return [values];
  }

  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize));
  }

  return chunks;
}

function parseRequestMode(request: Request): RequestMode {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode")?.toLowerCase();

  return mode === "preview" ? "preview" : "sync";
}

async function parseRequestBody(request: Request): Promise<VeteranRequestBody> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return {};
  }

  try {
    const body = (await request.json()) as VeteranRequestBody;
    return {
      mode: body.mode === "preview" || body.mode === "sync" ? body.mode : undefined,
      worker_ids: Array.isArray(body.worker_ids)
        ? body.worker_ids.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        : undefined,
    };
  } catch {
    return {};
  }
}

function requireAuthHeaders(request: Request) {
  const apikey = request.headers.get("apikey")?.trim();
  const authorization = request.headers.get("authorization")?.trim();

  if (!apikey || !authorization) {
    return new Response(JSON.stringify({
      success: false,
      error: "Missing required apikey or authorization header.",
    }), {
      status: 401,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  }

  return null;
}

function buildBadgeDefinitionRow(definition: VeteranBadgeDefinition) {
  return {
    badge_name: definition.badgeTier,
    description: `${definition.badgeTier} awarded for ${definition.minMonths}+ active months and at least one completed job.`,
    criteria: {
      category: "platform-veteran",
      min_months: definition.minMonths,
      max_months: definition.maxMonths,
      min_jobs_completed: 1,
      badge_slug: definition.badgeSlug,
    },
    is_active: true,
    display_order: definition.displayOrder,
    metadata: {
      badge_slug: definition.badgeSlug,
      category: "platform-veteran",
      active: true,
    },
  };
}

async function ensureVeteranBadges(
  supabase: any,
): Promise<Map<string, BadgeRow>> {
  const badgeRows: BadgeDefinitionRow[] = VETERAN_BADGES.map(buildBadgeDefinitionRow);

  const { data, error } = await supabase
    .from("badges")
    .upsert(badgeRows as any, { onConflict: "badge_name" })
    .select("id, badge_name");

  if (error) {
    throw new Error(`Unable to upsert veteran badge definitions: ${error.message}`);
  }

  const badgeMap = new Map<string, BadgeRow>();
  for (const row of data ?? []) {
    badgeMap.set(row.badge_name, row as BadgeRow);
  }

  return badgeMap;
}

async function fetchWorkers(supabase: any, workerIds?: string[]) {
  let query = supabase
    .from("workers")
    .select("id, user_id, first_name, last_name, display_name, email, created_at")
    .order("created_at", { ascending: true });

  if (workerIds && workerIds.length > 0) {
    query = query.in("id", workerIds);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Unable to load workers: ${error.message}`);
  }

  return (data ?? []) as WorkerRow[];
}

async function fetchUsersByIds(supabase: any, userIds: string[]) {
  if (userIds.length === 0) {
    return new Map<string, UserRow>();
  }

  const userMap = new Map<string, UserRow>();
  for (const batch of chunkArray(userIds, POSTGREST_IN_CLAUSE_BATCH_SIZE)) {
    const { data, error } = await supabase
      .from("users")
      .select("id, full_name, created_at")
      .in("id", batch);

    if (error) {
      throw new Error(`Unable to load users: ${error.message}`);
    }

    for (const row of (data ?? []) as UserRow[]) {
      userMap.set(row.id, row);
    }
  }

  return userMap;
}

async function fetchPerformanceByWorkerIds(supabase: any, workerIds: string[]) {
  if (workerIds.length === 0) {
    return new Map<string, PerformanceRow>();
  }

  const performanceMap = new Map<string, PerformanceRow>();
  for (const batch of chunkArray(workerIds, POSTGREST_IN_CLAUSE_BATCH_SIZE)) {
    const { data, error } = await supabase
      .from("worker_performance")
      .select("worker_id, total_jobs_completed")
      .in("worker_id", batch);

    if (error) {
      throw new Error(`Unable to load worker performance data: ${error.message}`);
    }

    for (const row of (data ?? []) as PerformanceRow[]) {
      performanceMap.set(row.worker_id, row);
    }
  }

  return performanceMap;
}

async function syncVeteranAssignments(
  supabase: any,
  workerIds: string[],
  results: WorkerResult[],
  badgeMap: Map<string, BadgeRow>,
) {
  const veteranBadgeIds = VETERAN_BADGES
    .map((badge) => badgeMap.get(badge.badgeTier)?.id)
    .filter((badgeId): badgeId is string => typeof badgeId === "string");

  if (workerIds.length === 0 || veteranBadgeIds.length === 0) {
    return;
  }

  // Remove any previously assigned veteran tiers so that each worker can only hold one veteran badge.
  const { error: deleteError } = await supabase
    .from("worker_badges")
    .delete()
    .in("worker_id", workerIds)
    .in("badge_id", veteranBadgeIds);

  if (deleteError) {
    throw new Error(`Unable to clear existing veteran badge assignments: ${deleteError.message}`);
  }

  const inserts: WorkerBadgeInsertRow[] = results
    .filter((result) => result.eligible && result.badge_tier)
    .map((result) => {
      const badgeId = badgeMap.get(result.badge_tier as string)?.id;
      if (!badgeId) {
        return null;
      }

      return {
        worker_id: result.worker_id,
        badge_id: badgeId,
        metadata: {
          badge_tier: result.badge_tier,
          badge_slug: result.badge_slug,
          active_months: result.active_months,
          total_jobs_completed: result.total_jobs_completed,
          source: "platform-veteran",
        },
      };
    })
    .filter((row): row is WorkerBadgeInsertRow => row !== null);

  if (inserts.length === 0) {
    return;
  }

  const { error: insertError } = await supabase
    .from("worker_badges")
    .insert(inserts as any);

  if (insertError) {
    throw new Error(`Unable to create veteran badge assignments: ${insertError.message}`);
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authFailure = requireAuthHeaders(request);
  if (authFailure) {
    return authFailure;
  }

  const responseHeaders = {
    ...corsHeaders,
    "Content-Type": "application/json; charset=utf-8",
  };

  try {
    const body = await parseRequestBody(request);
    const mode = body.mode ?? parseRequestMode(request);
    const supabase = buildSupabaseClient();

    // Load the worker list first, then fan out to users and performance records with a single query per table.
    const workers = await fetchWorkers(supabase, body.worker_ids);

    if (workers.length === 0) {
      return new Response(JSON.stringify({ success: true, processed_workers: 0, eligible_workers: 0, results: [] }), {
        headers: responseHeaders,
      });
    }

    const userIds = [...new Set(workers.map((worker) => worker.user_id).filter((value): value is string => Boolean(value)))];
    const workerIds = workers.map((worker) => worker.id);

    const [usersById, performanceByWorkerId, badgeMap] = await Promise.all([
      fetchUsersByIds(supabase, userIds),
      fetchPerformanceByWorkerIds(supabase, workerIds),
      ensureVeteranBadges(supabase),
    ]);

    const results: WorkerResult[] = workers.map((worker) => {
      const user = worker.user_id ? usersById.get(worker.user_id) ?? null : null;
      const performance = performanceByWorkerId.get(worker.id);
      const workerName = normalizeWorkerName(worker, user);
      const activeMonths = calculateMonths(user?.created_at ?? worker.created_at ?? null);
      const totalJobsCompleted = Math.max(0, Number(performance?.total_jobs_completed ?? 0));
      const veteranTier = getVeteranTier(activeMonths);
      const eligible = Boolean(veteranTier && totalJobsCompleted > 0);

      if (eligible && veteranTier) {
        return {
          worker_id: worker.id,
          worker_name: workerName,
          active_months: activeMonths,
          total_jobs_completed: totalJobsCompleted,
          badge_name: veteranTier.badgeTier,
          badge_tier: veteranTier.badgeTier,
          badge_slug: veteranTier.badgeSlug,
          eligible: true,
        };
      }

      return {
        worker_id: worker.id,
        worker_name: workerName,
        active_months: activeMonths,
        total_jobs_completed: totalJobsCompleted,
        badge_name: null,
        badge_tier: null,
        badge_slug: null,
        eligible: false,
        reason: totalJobsCompleted <= 0 ? "No completed gigs/jobs" : "Account age below veteran threshold",
      };
    });

    // Keep the veteran badge assignment table aligned with the latest eligibility calculation.
    if (mode === "sync") {
      await syncVeteranAssignments(supabase, workerIds, results, badgeMap);
    }

    const eligibleWorkers = results.filter((result) => result.eligible).length;

    return new Response(JSON.stringify({
      success: true,
      mode,
      processed_workers: results.length,
      eligible_workers: eligibleWorkers,
      results,
    }), {
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("platform-veteran badge function failed", error);

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unexpected error while calculating platform veteran badges.",
    }), {
      status: 500,
      headers: responseHeaders,
    });
  }
});