// @ts-nocheck

import { createClient } from "npm:@supabase/supabase-js@2";
import { evaluateTopPerformer } from "./evaluators/topPerformer.ts";

const deno = (globalThis as any)["Deno"];

// This entrypoint stays deliberately thin. It validates the request, delegates all
// badge decisions to the evaluator layer, and returns structured JSON responses.
deno.serve(async (request: Request) => {
  const requestId = crypto.randomUUID();
  const supabaseUrl = deno.env.get("SUPABASE_URL");
  const supabaseServiceRoleKey = deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  try {
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    if (request.method !== "POST") {
      return jsonResponse(
        {
          error: {
            code: "method_not_allowed",
            message: "Only POST requests are supported.",
            requestId,
          },
        },
        405,
      );
    }

    const apikeyHeader = request.headers.get("apikey") ?? "";
    if (!apikeyHeader.trim()) {
      return jsonResponse(
        {
          error: {
            code: "unauthorized",
            message: "Missing apikey header.",
            requestId,
          },
        },
        401,
      );
    }

    const authHeader = request.headers.get("authorization") ?? request.headers.get("Authorization") ?? "";
    const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";

    if (!accessToken) {
      return jsonResponse(
        {
          error: {
            code: "unauthorized",
            message: "Authorization bearer token is required.",
            requestId,
          },
        },
        401,
      );
    }

    const authResult = await supabase.auth.getUser(accessToken);
    if (authResult.error || !authResult.data?.user) {
      return jsonResponse(
        {
          error: {
            code: "unauthorized",
            message: "Invalid or expired access token.",
            requestId,
          },
        },
        401,
      );
    }

    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return jsonResponse(
        {
          error: {
            code: "invalid_json",
            message: "Request body must be valid JSON.",
            requestId,
          },
        },
        400,
      );
    }

    const workerId = typeof body.worker_id === "string" ? body.worker_id.trim() : "";
    const event = typeof body.event === "string" ? body.event.trim() : "";

    if (!workerId) {
      return jsonResponse(
        {
          error: {
            code: "validation_error",
            message: "worker_id is required.",
            requestId,
          },
        },
        400,
      );
    }

    if (!event) {
      return jsonResponse(
        {
          error: {
            code: "validation_error",
            message: "event is required.",
            requestId,
          },
        },
        400,
      );
    }

    // The event is accepted now so this function can evolve into a real event router.
    // For the first version, all supported events trigger the Top Performer evaluation.
    console.log(
      JSON.stringify({
        level: "info",
        requestId,
        workerId,
        event,
        userId: authResult.data.user.id,
        message: "Evaluating badge",
      }),
    );

    const result = await evaluateTopPerformer(supabase, workerId);

    if (!result) {
      return jsonResponse(
        {
          error: {
            code: "no_result",
            message: "No badge result could be produced.",
            requestId,
          },
        },
        200,
      );
    }

    return jsonResponse(result, 200, requestId);
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        requestId,
        message: "Badge engine failed",
        error: error instanceof Error ? error.message : String(error),
      }),
    );

    return jsonResponse(
      {
        error: {
          code: "internal_error",
          message: "Badge evaluation failed.",
          requestId,
        },
      },
      500,
    );
  }
});

function jsonResponse(payload: unknown, status: number, requestId?: string): Response {
  const headers: Record<string, string> = {
    "content-type": "application/json; charset=utf-8",
  };

  if (requestId) {
    headers["x-request-id"] = requestId;
  }

  return new Response(JSON.stringify(payload), {
    status,
    headers,
  });
}
