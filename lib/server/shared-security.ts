import { createHash, createHmac, timingSafeEqual } from "node:crypto";
export const EDIT_COOKIE = "london-editor";
export function equal(a: string, b: string) {
  return timingSafeEqual(
    createHash("sha256").update(a).digest(),
    createHash("sha256").update(b).digest(),
  );
}
function key() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY,
    pin = process.env.SHARED_EDIT_PIN;
  if (!secret || !pin) throw Error("Shared editing is not configured");
  return createHmac("sha256", secret)
    .update("london-editor-v1:" + pin)
    .digest();
}
export function editorToken(now = Date.now()) {
  const payload = String(Math.floor(now / 1000) + 8 * 60 * 60);
  return (
    payload + "." + createHmac("sha256", key()).update(payload).digest("hex")
  );
}
export function validEditor(token?: string, now = Date.now()) {
  if (!token) return false;
  try {
    const [exp, sig, ...rest] = token.split(".");
    return (
      !rest.length &&
      /^\d+$/.test(exp) &&
      Number(exp) > now / 1000 &&
      Number(exp) <= now / 1000 + 8 * 60 * 60 + 5 &&
      equal(sig || "", createHmac("sha256", key()).update(exp).digest("hex"))
    );
  } catch {
    return false;
  }
}
export function clientFingerprint(ip: string) {
  return createHmac("sha256", key())
    .update("attempt:" + ip)
    .digest("hex");
}
