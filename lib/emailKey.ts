export function emailToKey(email: string) {
  return email.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
}