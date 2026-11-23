import * as bcrypt from 'bcrypt';

/**
 * Native bcrypt: hashing runs in libuv's thread pool, so a burst of logins does not
 * freeze every other request the way the pure-JavaScript implementation did.
 * Cost 10 (OWASP minimum) is about 4x cheaper than 12 — this matters on a small
 * free-tier CPU. Older cost-12 hashes stay valid and are upgraded at next login.
 */
export const PASSWORD_HASH_ROUNDS = 10;

// Pre-computed hash compared when the account does not exist, so the response time
// does not reveal which identifiers are registered. Same cost as real hashes.
const DUMMY_HASH = '$2b$10$qomvahQ8ojTsuUKI/zSGKeDPNRKQ4zxrulLNhKuVTIQdpJk5pIwZy';

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, PASSWORD_HASH_ROUNDS);
}

/** Constant-time-ish check; a missing hash still costs one bcrypt compare. */
export async function verifyPassword(password: string, hash: string | null | undefined): Promise<boolean> {
  const matches = await bcrypt.compare(password, hash || DUMMY_HASH);
  return Boolean(hash) && matches;
}

/** True when the stored hash uses another cost and should be replaced after a successful login. */
export function needsRehash(hash: string): boolean {
  try {
    return bcrypt.getRounds(hash) !== PASSWORD_HASH_ROUNDS;
  } catch {
    return false;
  }
}
