# @milanote-api/parser

Strictly typed helpers for fetching and normalizing a shared Milanote board into
renderer-friendly JSON.

```ts
import { fetchMilanoteBoard } from "@milanote-api/parser";

const document = await fetchMilanoteBoard(process.env.MILANOTE_SHARE_URL!, {
  maxBoards: 100,
  timeoutMs: 15_000,
});
```

The returned document has a stable `version`, a non-secret `source`, an ISO
`fetchedAt` value, and a recursive `board`. Nodes form a discriminated union on
their uppercase `type`. Rich text contains both safe JSON `blocks` and derived
`plainText`.

Keep the share URL in a deployment secret. Neither the permission identifier nor
the acquired token is included in results or errors.

## Commands

```sh
pnpm --filter @milanote-api/parser test
pnpm --filter @milanote-api/parser build
```
