import {
  appleAppSiteAssociation,
  associationJsonHeaders,
} from "../../../lib/app-association";

export const dynamic = "force-static";

export function GET() {
  return new Response(JSON.stringify(appleAppSiteAssociation()), {
    headers: associationJsonHeaders(),
  });
}
