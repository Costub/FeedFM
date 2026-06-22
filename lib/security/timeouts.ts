import "server-only";

export function timeoutSignal(milliseconds: number) {
  if ("timeout" in AbortSignal) {
    return AbortSignal.timeout(milliseconds);
  }

  const controller = new AbortController();
  setTimeout(() => controller.abort(), milliseconds);

  return controller.signal;
}
