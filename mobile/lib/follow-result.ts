export type ToggleFollowOk = {
  ok: true;
  followed: boolean;
  itemKey: string;
  itemType: string;
};

export type ToggleFollowFailure = {
  ok: false;
  followed: boolean;
  itemKey: string;
  itemType: string;
  code:
    | "pending"
    | "not_configured"
    | "not_ready"
    | "max_follows"
    | "error";
  message: string;
};

export type ToggleFollowResult = ToggleFollowOk | ToggleFollowFailure;

export function followPendingKey(itemType: string, itemKey: string) {
  return `${itemType}:${itemKey}`;
}
