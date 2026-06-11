import type { BadgeSupabaseClient } from "../utils/supabase.ts";

const ELIGIBLE_STAGES = new Set(["assigned", "in_progress", "completed", "failed"]);

export async function getCompletionRate(
  supabase: BadgeSupabaseClient,
  workerId: string,
): Promise<number> {
  try {
    const eligibleQuery = supabase
      .from("candidate_pipeline")
      .select("stage", { head: true, count: "exact" })
      .eq("worker_id", workerId)
      .in("stage", Array.from(ELIGIBLE_STAGES));

    const completedQuery = supabase
      .from("candidate_pipeline")
      .select("stage", { head: true, count: "exact" })
      .eq("worker_id", workerId)
      .eq("stage", "completed");

    const [{ count: eligibleCount, error: eligibleError }, { count: completedCount, error: completedError }] =
      await Promise.all([eligibleQuery, completedQuery]);

    if (eligibleError) {
      throw new Error(eligibleError.message);
    }

    if (completedError) {
      throw new Error(completedError.message);
    }

    const safeEligibleCount = eligibleCount ?? 0;
    const safeCompletedCount = completedCount ?? 0;

    // A worker with no eligible pipeline records should safely return 0 instead of
    // causing a divide-by-zero or a misleading NaN value.
    if (safeEligibleCount === 0) {
      console.log(
        JSON.stringify({
          level: "info",
          workerId,
          table: "candidate_pipeline",
          eligibleCount: 0,
          completedCount: 0,
          completionRate: 0,
        }),
      );
      return 0;
    }

    const completionRate = Math.round((safeCompletedCount / safeEligibleCount) * 100);

    console.log(
      JSON.stringify({
        level: "info",
        workerId,
        table: "candidate_pipeline",
        eligibleCount: safeEligibleCount,
        completedCount: safeCompletedCount,
        completionRate,
      }),
    );

    return completionRate;
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        workerId,
        metric: "completionRate",
        error: error instanceof Error ? error.message : String(error),
      }),
    );

    throw new Error("Failed to fetch completion rate from candidate_pipeline.");
  }
}
