import type { SupabaseClient } from "@supabase/supabase-js";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type ConcertRow = {
  artist: string;
  city: string | null;
  created_at: string;
  created_by: string | null;
  description: string | null;
  event_date: string | null;
  id: string;
  is_published: boolean;
  venue: string | null;
};

type SavedItemRow = {
  created_at: string;
  id: string;
  item_key: string;
  item_label: string | null;
  item_type: string;
  user_id: string;
};

type SavedEventRow = {
  attractions: Json;
  city: string;
  created_at: string;
  date_label: string;
  date_status: string;
  event_status: string | null;
  id: string;
  image_url: string | null;
  local_date: string | null;
  local_time: string | null;
  matched_labels: string[];
  name: string;
  provider: string;
  provider_event_id: string;
  sale_ends_at: string | null;
  sale_starts_at: string | null;
  starts_at: string | null;
  state: string;
  ticket_url: string | null;
  time_label: string | null;
  timezone: string | null;
  updated_at: string;
  user_id: string;
  venue_address_line: string | null;
  venue_country_code: string | null;
  venue_id: string | null;
  venue_latitude: number | null;
  venue_longitude: number | null;
  venue_name: string;
  venue_postal_code: string | null;
  venue_state_code: string | null;
};

type WatchStateRow = {
  id: string;
  initialized_at: string;
  item_key: string;
  item_label: string | null;
  item_type: string;
  known_event_ids: string[];
  last_checked_at: string | null;
  last_error: string | null;
  new_event_ids: string[];
  user_id: string;
};

type Insert<Row, OptionalKeys extends keyof Row> = Omit<Row, OptionalKeys> &
  Partial<Pick<Row, OptionalKeys>>;

export type Database = {
  public: {
    Tables: {
      concerts: {
        Row: ConcertRow;
        Insert: Insert<
          ConcertRow,
          | "city"
          | "created_at"
          | "created_by"
          | "description"
          | "event_date"
          | "id"
          | "is_published"
          | "venue"
        >;
        Update: Partial<ConcertRow>;
        Relationships: [];
      };
      saved_items: {
        Row: SavedItemRow;
        Insert: Insert<SavedItemRow, "created_at" | "id">;
        Update: Partial<SavedItemRow>;
        Relationships: [];
      };
      saved_events: {
        Row: SavedEventRow;
        Insert: Insert<
          SavedEventRow,
          | "attractions"
          | "city"
          | "created_at"
          | "date_label"
          | "date_status"
          | "event_status"
          | "id"
          | "image_url"
          | "local_date"
          | "local_time"
          | "matched_labels"
          | "provider"
          | "sale_ends_at"
          | "sale_starts_at"
          | "starts_at"
          | "state"
          | "ticket_url"
          | "time_label"
          | "timezone"
          | "updated_at"
          | "venue_address_line"
          | "venue_country_code"
          | "venue_id"
          | "venue_latitude"
          | "venue_longitude"
          | "venue_name"
          | "venue_postal_code"
          | "venue_state_code"
        >;
        Update: Partial<SavedEventRow>;
        Relationships: [];
      };
      ticketmaster_watch_state: {
        Row: WatchStateRow;
        Insert: Insert<
          WatchStateRow,
          | "id"
          | "initialized_at"
          | "known_event_ids"
          | "last_checked_at"
          | "last_error"
          | "new_event_ids"
        >;
        Update: Partial<WatchStateRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_ticketmaster_watch_batch: {
        Args: { requested_limit?: number };
        Returns: {
          item_key: string;
          item_label: string;
          item_type: string;
          initialized_at: string | null;
          known_event_ids: string[];
          new_event_ids: string[];
          user_id: string;
        }[];
      };
      mark_ticketmaster_watch_state_seen: {
        Args: { target_id: string };
        Returns: undefined;
      };
      merge_anonymous_account_data: {
        Args: { source_user_id: string; target_user_id: string };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type AppSupabaseClient = SupabaseClient<Database>;
