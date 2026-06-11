import { getCompletionRate } from "../metrics/completion.ts";
import { getAverageRating } from "../metrics/ratings.ts";
import type { BadgeSupabaseClient } from "../utils/supabase.ts";

// This evaluator owns the Top Performer badge rules. Keeping it separate means the
// HTTP layer stays thin and new badges can be added as parallel evaluators later.
const BADGE_KEY = "top_performer";

const TIER_ORDER = ["diamond", "platinum", "gold", "silver", "bronze"] as const;

type TopPerformerTier = (typeof TIER_ORDER)[number];

type TierCondition = {
  op: ">=" | ">" | "<=" | "<" | "=";
  value: number;
};

type TierRule = Record<string, TierCondition>;

type BadgeRuleRow = {
  badge_key: string;
  badge_name: string;
  tiers: Record<TopPerformerTier, TierRule> | null;
  is_active: boolean | null;
};

export type TopPerformerResult = {
  badge: "Top Performer";
  tier: TopPerformerTier | null;
  metrics: {
    completionRate: number;
    avgRating: number;
  };
};

export async function evaluateTopPerformer(
  supabase: BadgeSupabaseClient,
  workerId: string,
): Promise<TopPerformerResult | null> {
  // These lookups are independent, so resolve them together to keep latency down.
  const [completionRate, avgRating, badgeRuleResult] = await Promise.all([
    getCompletionRate(supabase, workerId),
    getAverageRating(supabase, workerId),
    supabase
      .from("badge_rules")
      .select("badge_key, badge_name, tiers, is_active")
      .eq("badge_key", BADGE_KEY),
  ]);

  const badgeRule = findActiveBadgeRule(badgeRuleResult.data);
  const tier = badgeRule ? resolveTierFromRules(badgeRule.tiers, { completion_rate: completionRate, avg_rating: avgRating }) : null;

  console.log(
    JSON.stringify({
      level: "info",
      workerId,
      badge: "Top Performer",
      tier,
      completionRate,
      avgRating,
    }),
  );

  if (tier) {
    await persistTopPerformerBadge(supabase, workerId);
  }

  return {
    badge: "Top Performer",
    tier,
    metrics: {
      completionRate,
      avgRating,
    },
  };
}

async function persistTopPerformerBadge(supabase: BadgeSupabaseClient, workerId: string): Promise<void> {
  const badgeResult = await supabase
    .from("badges")
    .select("id")
    .eq("badge_name", "Top Performer");

  if (badgeResult.error) {
    throw new Error(badgeResult.error.message);
  }

  const badgeId = badgeResult.data?.[0]?.id;
  if (!badgeId || typeof badgeId !== "string") {
    throw new Error("Top Performer badge is missing from badges.");
  }

  const existingResult = await supabase
    .from("worker_badges")
    .select("id")
    .eq("worker_id", workerId)
    .eq("badge_id", badgeId);

  if (existingResult.error) {
    throw new Error(existingResult.error.message);
  }

  if ((existingResult.data ?? []).length > 0) {
    console.log(
      JSON.stringify({
        level: "info",
        workerId,
        badge: "Top Performer",
        badgeId,
        message: "Badge already assigned.",
      }),
    );
    return;
  }

  const insertResult = await supabase.from("worker_badges").insert({
    worker_id: workerId,
    badge_id: badgeId,
    earned_at: new Date().toISOString(),
  });

  if (insertResult.error) {
    throw new Error(insertResult.error.message);
  }

  console.log(
    JSON.stringify({
      level: "info",
      workerId,
      badge: "Top Performer",
      badgeId,
      message: "Badge assigned.",
    }),
  );
}

function findActiveBadgeRule(rows: Array<Record<string, unknown>> | null): BadgeRuleRow | null {
  if (!rows || rows.length === 0) {
    return null;
  }

  const row = rows[0] as BadgeRuleRow;
  if (!row.is_active) {
    return null;
  }

  return row;
}

function resolveTierFromRules(
  tiers: Record<TopPerformerTier, TierRule> | null,
  metrics: Record<string, number>,
): TopPerformerTier | null {
  if (!tiers) {
    return null;
  }

  for (const tier of TIER_ORDER) {
    const rule = tiers[tier];
    if (rule && matchesTierRule(rule, metrics)) {
      return tier;
    }
  }

  return null;
}

function matchesTierRule(rule: TierRule, metrics: Record<string, number>): boolean {
  return Object.entries(rule).every(([metricKey, condition]) => {
    const metricValue = metrics[metricKey];

    if (typeof metricValue !== "number") {
      return false;
    }

    return compare(metricValue, condition.op, condition.value);
  });
}

function compare(left: number, op: TierCondition["op"], right: number): boolean {
  switch (op) {
    case ">=":
      return left >= right;
    case ">":
      return left > right;
    case "<=":
      return left <= right;
    case "<":
      return left < right;
    case "=":
      return left === right;
  }
}
