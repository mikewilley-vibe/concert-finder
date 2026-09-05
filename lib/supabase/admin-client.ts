import { createClient } from "@supabase/supabase-js";
import type { AppSupabaseClient, Database } from "./database.types";

export class AdminConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminConfigError";
  }
}

let adminClient: AppSupabaseClient | null = null;

type AdminEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

function configured(value: string | undefined) {
  return value?.trim() ?? "";
}

function isSupportedAdminKey(value: string) {
  return value.startsWith("sb_secret_") ||
    (value.startsWith("eyJ") && value.split(".").length === 3);
}

export function resolveSupabaseAdminConfig(environment: AdminEnvironment) {
  const url =
    configured(environment.NEXT_PUBLIC_SUPABASE_URL) ||
    configured(environment.SUPABASE_URL);
  const secretKey = [
    configured(environment.SUPABASE_SECRET_KEY),
    configured(environment.SUPABASE_SERVICE_ROLE_KEY),
  ].find(isSupportedAdminKey) ?? "";

  return { url, secretKey };
}

export function getSupabaseAdminClient(): AppSupabaseClient {
  const { url, secretKey } = resolveSupabaseAdminConfig({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  if (!url || !secretKey) {
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
