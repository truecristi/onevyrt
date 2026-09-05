# @onevyrt/design-system

Design tokens (`tokens.ts`) plus the first five accessible primitives from
§12's required list: `Button`, `Input`, `EmptyState`, `ErrorState`,
`Skeleton`.

**Not yet built** (documented here per the work-package contract, §35,
rather than stubbed speculatively): `Link`, `Select`, `Checkbox`, `Radio`,
`Dialog`, `Drawer`, `Tabs`, `Table`, `Toast`, `ConfirmAction`. Each should be
its own small work package when the feature that needs it is implemented -
building them ahead of a real caller risks guessing the wrong API.

Components use Tailwind utility classes directly rather than the token
values in `tokens.ts` yet - wiring `tokens.ts` into `tailwind.config.ts`'s
`theme.extend` so both stay in sync is a fast-follow, tracked as a known gap
rather than done speculatively here.
