import { apiV1Error, apiV1Success } from "@/lib/api-v1-response";
import { authenticatedUser } from "@/lib/api-auth";
import {
  AdminConfigError,
  getSupabaseAdminClient,
} from "@/lib/supabase/admin-client";

export const dynamic = "force-dynamic";

function isConfirmed(body: unknown) {
  return (
    Boolean(body) &&
    typeof body === "object" &&
    (body as { confirmation?: unknown }).confirmation === "DELETE"
  );
}

export async function DELETE(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiV1Error(request, 400, "bad_request", "Invalid request.");
  }

  if (!isConfirmed(body)) {
    return apiV1Error(
      request,
      400,
      "bad_request",
      "Account deletion was not confirmed.",
    );
  }

  try {
    const user = await authenticatedUser(request);
    if (!user) {
      return apiV1Error(request, 401, "unauthorized", "Unauthorized.");
    }
    if (user.is_anonymous !== false) {
      return apiV1Error(
        request,
        403,
        "forbidden",
        "Only permanent accounts can be deleted here.",
      );
    }

    const admin = getSupabaseAdminClient();
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) {
      console.error("Account deletion failed");
      return apiV1Error(
        request,
        500,
        "internal_error",
        "Could not delete the account.",
      );
    }

    return apiV1Success(request, { deleted: true as const });
  } catch (error) {
    if (error instanceof AdminConfigError) {
      return apiV1Error(
        request,
        500,
        "not_configured",
        "Server database access is not configured.",
      );
    }
    console.error("Account deletion failed");
    return apiV1Error(
      request,
      500,
      "internal_error",
      "Could not delete the account.",
    );
  }
}
