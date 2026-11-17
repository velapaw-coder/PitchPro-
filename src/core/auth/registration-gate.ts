export function parseRegistrationAllowlist(
  raw: string | null | undefined
): Set<string> {
  const out = new Set<string>();
  for (const part of String(raw || '').split(/[\s,;]+/)) {
    const email = part.trim().toLowerCase();
    if (email.includes('@') && !email.startsWith('@')) out.add(email);
  }
  return out;
}

/**
 * Decision for creating a new account (email signup or first OAuth / One Tap).
 * Existing sign-in and password reset never reach this. An invite code is not
 * an approval, and no config value reopens public signup.
 */
export function newAccountDecision(input: {
  registrationMode?: string | null;
  allowlist: string | null | undefined;
  email: string | null | undefined;
}): { allow: boolean; reason: 'approved' | 'paused' } {
  const email = String(input.email || '')
    .trim()
    .toLowerCase();
  if (email && parseRegistrationAllowlist(input.allowlist).has(email)) {
    return { allow: true, reason: 'approved' };
  }
  return { allow: false, reason: 'paused' };
}
