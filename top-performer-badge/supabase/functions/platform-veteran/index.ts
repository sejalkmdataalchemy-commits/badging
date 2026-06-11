// @ts-nocheck

import { createClient } from "npm:@supabase/supabase-js@2";

const Deno = (globalThis as any)["Deno"];

Deno.serve(async (request: Request) => {
  const requestId = crypto.randomUUID();
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  try {
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    if (request.method !== "POST") {
      return jsonResponse({
        error: {
          code: "method_not_allowed",
          message: "Only POST requests are supported.",
          requestId,
        },
      }, 405);
    }

    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return jsonResponse({
        error: {
          code: "invalid_json",
          message: "Request body must be valid JSON.",
          requestId,
        },
      }, 400);
    }

    const workerId = typeof body.worker_id === "string" ? body.worker_id.trim() : "";

    if (!workerId) {
      return jsonResponse({
        error: {
          code: "validation_error",
          message: "worker_id is required.",
          requestId,
        },
      }, 400);
    }

    const result = await evaluatePlatformVeteran(supabase, workerId);

    if (!result) {
      return jsonResponse({
        error: {
          code: "no_result",
          message: "No badge result could be produced.",
          requestId,
        },
      }, 200);
    }

    return jsonResponse(result, 200, requestId);
  } catch (error) {
    console.error(JSON.stringify({ level: "error", requestId, message: "Platform Veteran failed", error: error instanceof Error ? error.message : String(error) }));

    return jsonResponse({
      error: {
        code: "internal_error",
        message: "Badge evaluation failed.",
        requestId,
      },
    }, 500);
  }
});

function jsonResponse(payload: unknown, status: number, requestId?: string): Response {
  const headers: Record<string, string> = {
    "content-type": "application/json; charset=utf-8",
  };

  if (requestId) headers["x-request-id"] = requestId;

  return new Response(JSON.stringify(payload), { status, headers });
}

// --- Evaluator implementation (self-contained) ---
async function evaluatePlatformVeteran(supabase: any, workerId: string) {
  try {
    const now = new Date();
    let accountAgeMonths: number | null = null;

    // Helper to fetch created_at timestamps from tables that directly expose worker_id.
    async function fetchWorkerTimestamps(table: string, column = "created_at") {
      try {
        const res = await supabase.from(table).select(column).eq("worker_id", workerId);
        if (res && res.error) {
          return { data: null, error: res.error };
        }

        const rows = (res && res.data) || [];
        return { data: rows.map((r: any) => r[column]).filter(Boolean), error: null };
      } catch (err) {
        return { data: null, error: err };
      }
    }

    async function fetchInterviewFeedbackTimestamps() {
      try {
        const interviewsRes = await supabase.from("interviews").select("id").eq("worker_id", workerId);

        if (interviewsRes && interviewsRes.error) {
          return { data: null, error: interviewsRes.error };
        }

        const interviewIds = ((interviewsRes && interviewsRes.data) || [])
          .map((row: any) => row.id)
          .filter(Boolean);

        if (interviewIds.length === 0) {
          return { data: [], error: null };
        }

        const feedbackRes = await supabase.from("interview_feedback").select("created_at").in("interview_id", interviewIds);

        if (feedbackRes && feedbackRes.error) {
          return { data: null, error: feedbackRes.error };
        }

        const rows = (feedbackRes && feedbackRes.data) || [];
        return { data: rows.map((row: any) => row.created_at).filter(Boolean), error: null };
      } catch (err) {
        return { data: null, error: err };
      }
    }

    // Collect timestamps from likely activity tables.
    const tablesToCheck = ["candidate_pipeline", "interviews", "audit_logs"];
    const monthKeys = new Set<string>();

    for (const table of tablesToCheck) {
      const { data, error } = await fetchWorkerTimestamps(table);
      if (error) {
        // table may not exist or permission denied; skip
        console.log(JSON.stringify({ level: "info", workerId, table, message: "skip table", error: error instanceof Error ? error.message : String(error) }));
        continue;
      }

      if (data && data.length > 0) {
        for (const ts of data) {
          const d = new Date(ts);
          if (Number.isNaN(d.getTime())) continue;
          const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
          monthKeys.add(key);
        }
      }
    }

    const feedbackTimestamps = await fetchInterviewFeedbackTimestamps();
    if (feedbackTimestamps.error) {
      console.log(
        JSON.stringify({
          level: "info",
          workerId,
          table: "interview_feedback",
          message: "skip table",
          error: feedbackTimestamps.error instanceof Error ? feedbackTimestamps.error.message : String(feedbackTimestamps.error),
        }),
      );
    } else {
      for (const ts of feedbackTimestamps.data ?? []) {
        const d = new Date(ts);
        if (Number.isNaN(d.getTime())) continue;
        const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
        monthKeys.add(key);
      }
    }

    let activeMonths = monthKeys.size;

    // If no activity timestamps were found, fall back to the worker record itself.
    if (activeMonths === 0) {
      try {
        const workersRes = await supabase.from("workers").select("created_at").eq("id", workerId);

        if (workersRes && workersRes.error) {
          console.log(JSON.stringify({ level: "info", workerId, table: "workers", message: "workers query error", error: workersRes.error.message }));
        } else if (workersRes && workersRes.data && workersRes.data.length > 0) {
          const createdAt = new Date(workersRes.data[0].created_at);
          if (!Number.isNaN(createdAt.getTime())) {
            accountAgeMonths = diffMonths(createdAt, now);
            activeMonths = accountAgeMonths;
          }
        }
      } catch (err) {
        console.log(JSON.stringify({ level: "info", workerId, table: "workers", message: "workers query failed", error: String(err) }));
      }
    }

    // Safety: coerce to number
    activeMonths = typeof activeMonths === "number" ? activeMonths : 0;
    accountAgeMonths = accountAgeMonths === null ? activeMonths : accountAgeMonths;

    const tier = determineTier(activeMonths);

    console.log(JSON.stringify({ level: "info", workerId, badge: "Platform Veteran", tier, activeMonths, accountAgeMonths }));

    return {
      badge: "Platform Veteran",
      tier,
      metrics: {
        activeMonths,
        accountAgeMonths,
      },
    };
  } catch (error) {
    console.error(JSON.stringify({ level: "error", workerId, message: "evaluatePlatformVeteran failed", error: error instanceof Error ? error.message : String(error) }));
    return null;
  }
}

function diffMonths(from: Date, to: Date) {
  const years = to.getUTCFullYear() - from.getUTCFullYear();
  const months = to.getUTCMonth() - from.getUTCMonth();
  const total = years * 12 + months;
  return total >= 0 ? total : 0;
}

function determineTier(activeMonths: number) {
  if (activeMonths >= 36) return "diamond";
  if (activeMonths >= 24) return "platinum";
  if (activeMonths >= 12) return "gold";
  if (activeMonths >= 6) return "silver";
  if (activeMonths >= 3) return "bronze";
  return null;
}
