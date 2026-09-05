import { apiV1Error, apiV1Success } from "@/lib/api-v1-response";
import { authenticatedUser } from "@/lib/api-auth";
import {
  AdminConfigError,
  getSupabaseAdminClient,
} from "@/lib/supabase/admin-client";

export const dynamic = "force-dynamic";

export const ACCOUNT_DELETE_CONFIRMATION_HEADER = "x-confirm-account-delete";

function headerConfirmed(request: Request) {
  return (
    request.headers.get(ACCOUNT_DELETE_CONFIRMATION_HEADER)?.trim() ===
    "DELETE"
  );
}

async function isConfirmed(request: Request) {
  if (headerConfirmed(request)) {
    return { ok: true as const };
  }

  const text = await request.text();
  if (!text.trim()) {
    return { ok: false as const, invalidJson: false };
  }

  try {
    const body: unknown = JSON.parse(text);
    const confirmed =
      Boolean(body) &&
      typeof body === "object" &&
      (body as { confirmation?: unknown }).confirmation === "DELETE";
    return { ok: confirmed, invalidJson: false };
  } catch {
    return { ok: false as const, invalidJson: true };
  }
}

async function deleteAccount(request: Request) {
  const confirmation = await isConfirmed(request);
  if (confirmation.invalidJson) {
    return apiV1Error(request, 400, "bad_request", "Invalid request.");
  }
  if (!confirmation.ok) {
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

export async function DELETE(request: Request) {
  return deleteAccount(request);
}

export async function POST(request: Request) {
  return deleteAccount(request);
}
