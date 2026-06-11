import { evaluateTopPerformer } from "../supabase/functions/top-performer-badging/evaluators/topPerformer.ts";

// This script exercises the badge logic directly so the engine can be validated
// even when the Supabase local runtime is unavailable on the machine.
async function main() {
  const supabase = createMockSupabase();
  const result = await evaluateTopPerformer(supabase, "123");

  if (!result) {
    throw new Error("Expected a badge result, but received null.");
  }

  const expected = {
    badge: "Top Performer",
    tier: "gold",
    metrics: {
      completionRate: 91,
      avgRating: 4.5,
    },
  };

  const actual = JSON.stringify(result);
  const wanted = JSON.stringify(expected);

  if (actual !== wanted) {
    throw new Error(`Unexpected badge result.\nExpected: ${wanted}\nActual:   ${actual}`);
  }

  console.log(JSON.stringify({ ok: true, result }, null, 2));
}

function createMockSupabase() {
  const rowsByTable = {
    candidate_pipeline: [
      { worker_id: "123", stage: "completed" },
      { worker_id: "123", stage: "completed" },
      { worker_id: "123", stage: "completed" },
      { worker_id: "123", stage: "completed" },
      { worker_id: "123", stage: "completed" },
      { worker_id: "123", stage: "completed" },
      { worker_id: "123", stage: "completed" },
      { worker_id: "123", stage: "completed" },
      { worker_id: "123", stage: "completed" },
      { worker_id: "123", stage: "completed" },
      { worker_id: "123", stage: "failed" },
    ],
    interview_feedback: [
      { worker_id: "123", rating: 4 },
      { worker_id: "123", rating: 5 },
    ],
  };

  return {
    from(table) {
      return {
        select(_columns, options = {}) {
          const filters = [];

          const builder = {
            eq(column, value) {
              filters.push({ type: "eq", column, value });
              return builder;
            },
            in(column, values) {
              filters.push({ type: "in", column, values });
              return builder;
            },
            then(onFulfilled, onRejected) {
              try {
                const rows = rowsByTable[table] ?? [];
                const filteredRows = rows.filter((row) => {
                  return filters.every((filter) => {
                    if (filter.type === "eq") {
                      return row[filter.column] === filter.value;
                    }

                    return filter.values.includes(row[filter.column]);
                  });
                });

                const result = {
                  data: options.head ? null : filteredRows,
                  count: options.count ? filteredRows.length : null,
                  error: null,
                };

                return Promise.resolve(result).then(onFulfilled, onRejected);
              } catch (error) {
                return Promise.reject(error).then(onFulfilled, onRejected);
              }
            },
          };

          return builder;
        },
      };
    },
  };
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});