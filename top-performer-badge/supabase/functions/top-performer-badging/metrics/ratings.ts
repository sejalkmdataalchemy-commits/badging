import type { BadgeSupabaseClient } from "../utils/supabase.ts";

// This module owns rating aggregation so badge logic can ask for a clean average
// rather than knowing how interview feedback is stored or calculated.
type FeedbackRow = {
  rating: number | string | null;
};

type InterviewRow = {
  id: string;
};

export async function getAverageRating(
  supabase: BadgeSupabaseClient,
  workerId: string,
): Promise<number> {
  try {
    const interviewsResult = await supabase
      .from("interviews")
      .select("id")
      .eq("worker_id", workerId);

    if (interviewsResult.error) {
      throw new Error(interviewsResult.error.message);
    }

    const interviewIds = ((interviewsResult.data ?? []) as InterviewRow[])
      .map((row) => row.id)
      .filter((id): id is string => Boolean(id));

    if (interviewIds.length === 0) {
      console.log(
        JSON.stringify({
          level: "info",
          workerId,
          table: "interview_feedback",
          interviewCount: 0,
          rowCount: 0,
          validRatingCount: 0,
          avgRating: 0,
        }),
      );
      return 0;
    }

    const { data, error } = await supabase
      .from("interview_feedback")
      .select("rating, interview_id")
      .in("interview_id", interviewIds);

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data ?? []) as FeedbackRow[];
    const ratings = rows
      .map((row) => (row.rating === null ? Number.NaN : Number(row.rating)))
      .filter((rating) => Number.isFinite(rating));

    // Empty feedback should safely resolve to 0 so the badge engine stays stable
    // even before a worker has enough interview history.
    if (ratings.length === 0) {
      console.log(
        JSON.stringify({
          level: "info",
          workerId,
          table: "interview_feedback",
          interviewCount: interviewIds.length,
          rowCount: rows.length,
          validRatingCount: 0,
          avgRating: 0,
        }),
      );
      return 0;
    }

    const averageRating = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
    const roundedAverageRating = Math.round(averageRating * 10) / 10;

    console.log(
      JSON.stringify({
        level: "info",
        workerId,
        table: "interview_feedback",
        interviewCount: interviewIds.length,
        rowCount: rows.length,
        validRatingCount: ratings.length,
        avgRating: roundedAverageRating,
      }),
    );

    return roundedAverageRating;
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        workerId,
        metric: "avgRating",
        error: error instanceof Error ? error.message : String(error),
      }),
    );

    throw new Error("Failed to fetch average rating from interview_feedback.");
  }
}
