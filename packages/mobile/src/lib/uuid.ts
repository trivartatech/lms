/**
 * Tiny UUID v4 generator — no external dependency.
 *
 * Uses the JS RNG (Math.random). That's cryptographically weak, but these
 * UUIDs are only used as idempotency keys scoped to a single user on the
 * server. The worst collision outcome is a legitimate mutation being
 * short-circuited by a cached response — extremely unlikely with 122 bits of
 * entropy per user, and recoverable on next request anyway.
 */
export function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
