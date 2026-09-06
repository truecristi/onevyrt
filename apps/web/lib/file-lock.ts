/**
 * Serializes read-modify-write sequences against the same file so concurrent
 * requests can't race and silently drop each other's writes. Every JSON
 * "store" in this app (sessions, users, workspaces, tracking) follows the
 * same pattern — read the whole file, mutate an array, write the whole file
 * back — with nothing to stop two requests from both reading the same
 * snapshot and one write clobbering the other's. Concretely: two logins
 * landing close together can each read the same session list, each append
 * their own new session, and whichever writes second wins — silently
 * erasing the first login's session record, so that user's very next
 * request finds them logged out right after logging in.
 *
 * This is an in-process queue, not real cross-process/cross-instance
 * locking — correct and sufficient for this app's single-process
 * deployment, not a substitute for a real database's transactions if this
 * ever runs as more than one instance.
 */
const locks = new Map<string, Promise<unknown>>();

export async function withFileLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  const result = prev.then(fn, fn);
  // Swallow rejection in the map's chain (it still propagates to the
  // caller via `result`/await below) so one failed operation doesn't
  // permanently wedge the queue for everyone after it.
  locks.set(key, result.catch(() => {}));
  return result;
}
