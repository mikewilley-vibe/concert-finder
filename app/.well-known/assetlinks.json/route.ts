import {
  androidAssetLinks,
  androidSha256Fingerprints,
  associationJsonHeaders,
} from "../../../lib/app-association";

export const dynamic = "force-dynamic";

export function GET() {
  return new Response(
    JSON.stringify(androidAssetLinks(androidSha256Fingerprints())),
    {
      headers: associationJsonHeaders(),
    },
  );
}
