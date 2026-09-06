# @onevyrt/engine

The GEAR Box simulation core. Pure TypeScript, **zero runtime dependencies**.

- Money is integer **minor units** (cents) end to end — no float drift, no
  decimal.js needed. Rounding is explicit banker's rounding (see `money.ts`).
- Population is carried as an expected-value real number and is never rounded
  mid-funnel. Splits conserve population exactly (`no = inflow - yes`).
- `simulate(funnel)` is a pure function: same input -> byte-identical output.
- Runs and tests under bare Node (>= 22) via native type-stripping. No build
  step, no test framework: `npm test` -> `node --test`.

Node features deliberately avoided so native strip-mode works: parameter
properties, enums, namespaces. Keep it that way until a real tsc build exists.
