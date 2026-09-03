import { AdminConfigError, getSupabaseAdminClient } from "../../../../lib/supabase/admin-client";

export const dynamic = "force-dynamic";

const MAX_TOKEN_LENGTH = 8192;

function bearerToken(request: Request) {
  const header = request.headers.get("authorization")?.trim() ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

function previousToken(body: unknown) {
  if (!body || typeof body !== "object") {
    return "";
  }

  const value = (body as { previousAccessToken?: unknown })
    .previousAccessToken;
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const currentAccessToken = bearerToken(request);
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const anonymousAccessToken = previousToken(body);
  if (
    !currentAccessToken ||
    !anonymousAccessToken ||
    currentAccessToken.length > MAX_TOKEN_LENGTH ||
    anonymousAccessToken.length > MAX_TOKEN_LENGTH
  ) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const admin = getSupabaseAdminClient();
    const [currentResult, anonymousResult] = await Promise.all([
      admin.auth.getUser(currentAccessToken),
      admin.auth.getUser(anonymousAccessToken),
    ]);
    const currentUser = currentResult.data.user;
    const anonymousUser = anonymousResult.data.user;

    if (
      currentResult.error ||
      anonymousResult.error ||
      !currentUser ||
      !anonymousUser
    ) {
      return Response.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (
      currentUser.is_anonymous !== false ||
      anonymousUser.is_anonymous !== true ||
      currentUser.id === anonymousUser.id
    ) {
      return Response.json({ error: "Account transfer is not allowed." }, { status: 403 });
    }

    const { error: mergeError } = await admin.rpc(
      "merge_anonymous_account_data",
      {
        source_user_id: anonymousUser.id,
        target_user_id: currentUser.id,
      },
    );

    if (mergeError) {
      console.error("Anonymous account data transfer failed");
      return Response.json(
        { error: "Could not transfer account data." },
        { status: 500 },
      );
    }

    // The data is already safe on the permanent account. Failure to remove
    // the now-empty anonymous auth record should not turn this into a failed
    // transfer or tempt the client to retry it.
    await admin.auth.admin.deleteUser(anonymousUser.id);

    return Response.json({ merged: true });
  } catch (error) {
    if (error instanceof AdminConfigError) {
      return Response.json(
        { error: "Server database access is not configured." },
        { status: 500 },
      );
    }

    console.error("Anonymous account transfer failed");
    return Response.json(
      { error: "Could not transfer account data." },
      { status: 500 },
    );
  }
}
