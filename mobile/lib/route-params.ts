export function firstRouteParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return firstRouteParam(value[0]);
  }
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
