import { createClient } from "@supabase/supabase-js";
import type { AppSupabaseClient, Database } from "./database.types";

export class AdminConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminConfigError";
  }
}

let adminClient: AppSupabaseClient | null = null;

export function getSupabaseAdminClient(): AppSupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();

  if (!url || !secretKey || !secretKey.startsWith("sb_secret_")) {
    throw new AdminConfigError("Server database access is not configured.");
  }

  if (adminClient) {
    return adminClient;
  }

  adminClient = createClient<Database>(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return adminClient;
}
