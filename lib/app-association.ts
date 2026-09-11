import { AUTH_ASSOCIATION } from "../shared/auth-callback.ts";

const APP_ID = `${AUTH_ASSOCIATION.appleTeamId}.${AUTH_ASSOCIATION.bundleId}`;

export function appleAppSiteAssociation() {
  return {
    applinks: {
      apps: [],
      details: [
        {
          appIDs: [APP_ID],
          components: [
            {
              "/": "/auth/callback",
              comment: "ShowSignal email confirmation and recovery",
            },
            {
              "/": "/auth/callback/*",
              comment: "ShowSignal email confirmation and recovery",
            },
          ],
        },
        {
          appID: APP_ID,
          paths: ["/auth/callback", "/auth/callback/*"],
        },
      ],
    },
  };
}

export function androidAssetLinks(fingerprints: string[]) {
  if (fingerprints.length === 0) {
    return [];
  }

  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: AUTH_ASSOCIATION.bundleId,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];
}

export function androidSha256Fingerprints() {
  const configured = process.env.ANDROID_APP_LINK_SHA256 ?? "";
  return configured
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export function associationJsonHeaders() {
  return {
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=3600",
  };
}
