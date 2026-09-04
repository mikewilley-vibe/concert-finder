import { apiV1Error, apiV1Success } from "@/lib/api-v1-response";
import {
  authenticatedUser,
  verifySupabaseAccessToken,
} from "@/lib/api-auth";
import {
  AdminConfigError,
  getSupabaseAdminClient,
} from "@/lib/supabase/admin-client";

export const dynamic = "force-dynamic";

function previousToken(body: unknown) {
  if (!body || typeof body !== "object") {
    return "";
  }
  const value = (body as { previousAccessToken?: unknown })
    .previousAccessToken;
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiV1Error(request, 400, "bad_request", "Invalid request.");
  }

  try {
    const [currentUser, anonymousUser] = await Promise.all([
      authenticatedUser(request),
      verifySupabaseAccessToken(previousToken(body)),
    ]);

    if (!currentUser || !anonymousUser) {
      return apiV1Error(request, 401, "unauthorized", "Unauthorized.");
    }
    if (
      currentUser.is_anonymous !== false ||
      anonymousUser.is_anonymous !== true ||
      currentUser.id === anonymousUser.id
    ) {
      return apiV1Error(
        request,
        403,
        "forbidden",
        "Account transfer is not allowed.",
      );
    }

    const admin = getSupabaseAdminClient();
    const { error: mergeError } = await admin.rpc(
      "merge_anonymous_account_data",
      {
        source_user_id: anonymousUser.id,
        target_user_id: currentUser.id,
      },
    );

    if (mergeError) {
      console.error("Anonymous account data transfer failed");
      return apiV1Error(
        request,
        500,
        "internal_error",
        "Could not transfer account data.",
      );
    }

    await admin.auth.admin.deleteUser(anonymousUser.id);
    return apiV1Success(request, { merged: true as const });
  } catch (error) {
    if (error instanceof AdminConfigError) {
      return apiV1Error(
        request,
        500,
        "not_configured",
        "Server database access is not configured.",
      );
    }
    console.error("Anonymous account transfer failed");
    return apiV1Error(
      request,
      500,
      "internal_error",
      "Could not transfer account data.",
    );
  }
}
