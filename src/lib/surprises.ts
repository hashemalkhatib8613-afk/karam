export type SurpriseState = "locked" | "countdown" | "available" | "completed" | "expired";

export function surpriseCountdown(unlockAt: string | null | undefined, now = Date.now()): string {
  if (!unlockAt) return "";
  const remaining = Date.parse(unlockAt) - now;
  if (!Number.isFinite(remaining) || remaining <= 0) return "soon";
  const minutes = Math.ceil(remaining / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 48) return `${hours} hr`;
  const days = Math.ceil(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

export function surpriseTypeLabel(type: string | null | undefined): string {
  return ({ gift: "A gift for you", envelope: "A sealed message", countdown: "Worth the wait", gallery: "A hidden gallery", quiz: "A little challenge" } as Record<string, string>)[type ?? ""] ?? "A surprise for you";
}
