/**
 * Where the app's data lives.
 *
 * Every server lib MUST resolve its root through here. Six copies of this logic
 * previously drifted apart, and two of them used process.cwd() directly. Since
 * the service runs with WorkingDirectory=apps/web, those two created a second
 * `.gearbox` under apps/web — which the others' walk-up then found FIRST,
 * silently repointing the whole app at an empty data directory. Every login
 * failed because users.json wasn't there. One resolver, used everywhere,
 * removes that entire class of bug.
 *
 * Resolution order:
 *   1. ONEVYRT_ROOT, when set and real (explicit beats clever).
 *   2. The nearest ancestor holding pnpm-workspace.yaml — the definitive marker
 *      of the monorepo root. Checked first precisely so a stray `.gearbox`
 *      cannot hijack resolution again.
 *   3. Failing that, the HIGHEST ancestor holding a `.gearbox` directory.
 *   4. cwd, as a last resort.
 */
import { existsSync } from "node:fs";
import path from "node:path";

const MAX_DEPTH = 8;

export function projectRoot(): string {
  const env = process.env.ONEVYRT_ROOT;
  if (env && existsSync(env)) return env;

  let dir = process.cwd();
  const gearboxDirs: string[] = [];

  for (let i = 0; i < MAX_DEPTH; i++) {
    // pnpm-workspace.yaml is definitive: stop the moment we see it.
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    if (existsSync(path.join(dir, ".gearbox"))) gearboxDirs.push(dir);
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  // No workspace marker anywhere: prefer the OUTERMOST .gearbox we saw, since a
  // nested one is far more likely to be an accident than the real data root.
  return gearboxDirs.length ? gearboxDirs[gearboxDirs.length - 1]! : process.cwd();
}

export function gearboxDir(): string {
  return path.join(projectRoot(), ".gearbox");
}

/**
 * Log the resolved root once per process, and shout if the layout looks like the
 * failure that cost an evening: a `.gearbox` sitting inside the working directory
 * while the real one lives further up. Silent misresolution is the dangerous kind.
 */
let announced = false;
export function announceRoot(): void {
  if (announced) return;
  announced = true;
  const root = projectRoot();
  const cwd = process.cwd();
  console.log(`[gearbox] data root: ${root}`);
  if (cwd !== root && existsSync(path.join(cwd, ".gearbox"))) {
    console.warn(
      `[gearbox] WARNING: a stray .gearbox exists at ${path.join(cwd, ".gearbox")} ` +
      `but the data root is ${root}. Something wrote to the wrong place. ` +
      `Move or delete the stray directory.`,
    );
  }
}
