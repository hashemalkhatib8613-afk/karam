export const LOGIN_METHODS = ["email", "username", "date"] as const;
export type LoginMethod = (typeof LOGIN_METHODS)[number];

export function isLoginMethod(value: unknown): value is LoginMethod {
  return LOGIN_METHODS.includes(value as LoginMethod);
}

export function loginMethod(value: unknown): LoginMethod {
  return isLoginMethod(value) ? value : "email";
}

export const DEFAULT_LOGIN_HEADLINE = "A little world, just for us.";

const EMAIL_ADDRESS = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

export function containsEmailAddress(value: unknown): boolean {
  return EMAIL_ADDRESS.test(String(value ?? ""));
}

/** Public copy must never expose an account identifier. */
export function publicLoginHeadline(value: unknown): string {
  const headline = String(value ?? "").trim();
  return headline && !containsEmailAddress(headline) ? headline : DEFAULT_LOGIN_HEADLINE;
}
