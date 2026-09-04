import { randomUUID } from "node:crypto";
import {
  API_VERSION,
  type ApiErrorCode,
  type ApiFailure,
  type ApiSuccess,
} from "../shared/api/v1";

function requestId(request: Request) {
  return request.headers.get("x-request-id")?.trim() || randomUUID();
}

export function apiV1Success<T>(request: Request, data: T, init?: ResponseInit) {
  const payload: ApiSuccess<T> = {
    apiVersion: API_VERSION,
    data,
    meta: { requestId: requestId(request) },
  };
  return Response.json(payload, init);
}

export function apiV1Error(
  request: Request,
  status: number,
  code: ApiErrorCode,
  message: string,
  init?: Omit<ResponseInit, "status">,
) {
  const payload: ApiFailure = {
    apiVersion: API_VERSION,
    error: { code, message },
    meta: { requestId: requestId(request) },
  };
  return Response.json(payload, { ...init, status });
}

export function ticketmasterErrorCode(status: number) {
  if (status === 400) return "bad_request" as const;
  if (status === 401) return "unauthorized" as const;
  if (status === 403) return "forbidden" as const;
  if (status === 404) return "not_found" as const;
  if (status === 429) return "rate_limited" as const;
  if (status === 500) return "not_configured" as const;
  return "upstream_error" as const;
}
