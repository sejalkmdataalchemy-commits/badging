// This file defines the narrow Supabase client contract used by the badge engine.
// Keeping the type minimal avoids coupling the evaluator and metric modules to the
// full SDK surface while still letting us inject either the real client or a mock.

type BadgeQueryResult = {
  data: Array<Record<string, unknown>> | null;
  count: number | null;
  error: { message: string } | null;
};

type BadgeQueryBuilder = PromiseLike<BadgeQueryResult> & {
  eq(column: string, value: string): BadgeQueryBuilder;
  in(column: string, values: string[]): BadgeQueryBuilder;
};

export type BadgeSupabaseClient = {
  from(table: string): {
    select(columns: string, options?: { head?: boolean; count?: "exact" | "planned" | "estimated" }): BadgeQueryBuilder;
    insert(values: Record<string, unknown> | Array<Record<string, unknown>>): PromiseLike<{
      error: { message: string } | null;
    }>;
  };
};
