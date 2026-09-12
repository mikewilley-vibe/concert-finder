import assert from "node:assert/strict";
import test from "node:test";
import {
  claimDevicePushToken,
  formatPushAlertError,
  isPermissionDeniedError,
} from "../mobile/lib/push-token-claim.ts";

test("formatPushAlertError surfaces Supabase code and message", () => {
  const rlsError = {
    code: "42501",
    message:
      'new row violates row-level security policy (USING expression) for table "push_tokens"',
    details: null,
  };

  assert.equal(isPermissionDeniedError(rlsError), true);
  assert.equal(
    formatPushAlertError(rlsError, "Could not save this device's push token."),
    'Could not save this device\'s push token. Permission denied (42501 — new row violates row-level security policy (USING expression) for table "push_tokens").',
  );

  assert.equal(
    formatPushAlertError(
      { code: "PGRST202", message: "Could not find the function" },
      "Could not save this device's push token.",
    ),
    "Could not save this device's push token. (PGRST202 — Could not find the function)",
  );

  assert.equal(
    formatPushAlertError(
      new Error("Invalid uuid"),
      "Could not get an Expo push token for this device.",
    ),
    "Could not get an Expo push token for this device. (Invalid uuid)",
  );

  assert.equal(
    formatPushAlertError(null, "Could not turn on push alerts. Try again."),
    "Could not turn on push alerts. Try again.",
  );
});

test("claimDevicePushToken calls the claim RPC and throws PostgREST errors", async () => {
  const calls = [];
  const supabase = {
    async rpc(name, args) {
      calls.push({ name, args });
      return { error: null };
    },
  };

  await claimDevicePushToken(supabase, {
    expoPushToken: "ExponentPushToken[abc]",
    platform: "ios",
  });

  assert.deepEqual(calls, [
    {
      name: "claim_device_push_token",
      args: {
        p_expo_push_token: "ExponentPushToken[abc]",
        p_platform: "ios",
      },
    },
  ]);

  const failing = {
    async rpc() {
      return {
        error: {
          code: "42501",
          message: "Not authenticated",
        },
      };
    },
  };

  await assert.rejects(
    () =>
      claimDevicePushToken(failing, {
        expoPushToken: "ExponentPushToken[abc]",
        platform: "android",
      }),
    { code: "42501", message: "Not authenticated" },
  );
});
