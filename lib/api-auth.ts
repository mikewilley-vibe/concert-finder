import type { User } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "./supabase/admin-client";

const MAX_ACCESS_TOKEN_LENGTH = 8192;

export function bearerAccessToken(request: Request) {
  const header = request.headers.get("authorization")?.trim() ?? "";
  if (!header.startsWith("Bearer ")) {
    return "";
  }
  const token = header.slice(7).trim();
  return token.length <= MAX_ACCESS_TOKEN_LENGTH ? token : "";
}

export async function verifySupabaseAccessToken(accessToken: string) {
  if (!accessToken || accessToken.length > MAX_ACCESS_TOKEN_LENGTH) {
    return null;
  }
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.auth.getUser(accessToken);
  return error ? null : (data.user as User | null);
}

export async function authenticatedUser(request: Request) {
  return verifySupabaseAccessToken(bearerAccessToken(request));
}
