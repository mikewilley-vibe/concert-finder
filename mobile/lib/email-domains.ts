export const EMAIL_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "icloud.com",
] as const;

export function completeEmailDomain(value: string, domain: string) {
  const localPart = value.trim().split("@", 1)[0]?.trim() ?? "";
  return localPart ? `${localPart}@${domain}` : value;
}
