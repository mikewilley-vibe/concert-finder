import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export class AdminConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminConfigError";
  }
}

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();

  if (!url || !secretKey || !secretKey.startsWith("sb_secret_")) {
    throw new AdminConfigError("Server database access is not configured.");
  }

  if (adminClient) {
    return adminClient;
  }

  adminClient = createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return adminClient;
}
