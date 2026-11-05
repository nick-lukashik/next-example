# next-example

The full Next.js reference on this platform: everything in [`next-starter`](https://github.com/nick-lukashik/next-starter) plus data from an API (the `/api` proxy, TanStack Query, a typed client, toasts), wired and tested end to end. Backend: an API implementing the notes contract (OpenAPI document in `e2e/mock-api/openapi.json`); the bundled mock serves it for development and tests, and [`nest-example`](https://github.com/nick-lukashik/nest-example) implements it.

It is not a template. A new site starts from `next-starter` and copies the API part from here only if it calls a backend ("Add the API" in the starter's README).

## What is inside

- Next.js 16.4 (App Router, `output: 'standalone'`, React Compiler, typed routes), React 19.3, TypeScript 7 strict, Node 26, pnpm 12.
- TanStack Query 5: server prefetch and `HydrationBoundary`, cursor-based infinite list, optimistic create with rollback, per-field validation errors, stats polling.
- Typed API client: types from OpenAPI (`openapi-typescript`), `ApiError` for the error contract, query key factory.
- SEO: title/description in both languages, canonical, hreflang, Open Graph and Twitter, `robots.txt`, `sitemap.xml`, OG image, icons, manifest, JSON-LD.
- Security: per-request nonce CSP (no `unsafe-inline` for scripts or styles in production), security headers, `/api` proxy on the same origin with a 1 MiB body cap, deadlines and a request header allow-list ([identity model](docs/auth.md)).
- EN and RU without a locale in the URL.
- UI: shadcn/ui (Radix base, neutral palette, one light theme): Button, Input, Textarea, Label, Field, Card, Skeleton, Sonner toasts. AA contrast, checked by axe.
- Env through Zod, Pino JSON logs with request id, `/health/live` and `/health/ready` probes, 404 and error pages.
- Biome, Vitest, Playwright with axe, Dockerfile, CI, Renovate.
- Agent rules: [AGENTS.md](AGENTS.md) and [.claude/rules/](.claude/rules/).

## Getting started

Requires Node 26 and pnpm 12.

```bash
pnpm install
pnpm env:local          # .env.local from .env.example
pnpm mock:api           # terminal 1: mock API on :4000 (45 notes in memory)
pnpm dev                # terminal 2: http://localhost:3000
```

To use a real backend, point `API_URL` in `.env.local` at it. Production build locally: `pnpm build && pnpm start` (the same `server.js` as in the container).

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | dev server on `:3000` |
| `pnpm build` / `pnpm start` | standalone build and running it |
| `pnpm verify` | Biome + `next typegen && tsc` + Vitest + build |
| `pnpm test:e2e` | Playwright against the build and the mock API (run `pnpm build` first; browser: `pnpm exec playwright install chromium`) |
| `pnpm test:e2e:real` | the notes specs against a real API at `E2E_API_URL` ([below](#end-to-end-against-a-real-api)) |
| `pnpm test` | unit tests |
| `pnpm lint` / `pnpm format` | Biome check / fix |
| `pnpm api:types [source]` | regenerate `src/lib/api/schema.d.ts`; source is the argument, else `OPENAPI_URL`, else `e2e/mock-api/openapi.json`; `-- --check` fails if the file is stale |
| `pnpm mock:api` | mock API (`PORT`, `MOCK_DELAY_MS`, `MOCK_STATS_DELAY_MS`) |
| `pnpm env:local` | create or update `.env.local` |
| `pnpm exec shadcn add <name>` | add a shadcn/ui component (CLI pinned in `devDependencies`) |

## Where to find each example

| What | Where |
|---|---|
| QueryClient: browser singleton, one per request on the server, devtools in dev only | `src/lib/query/`, `src/app/providers.tsx` |
| API client, errors, keys and query options | `src/lib/api/` (`client.ts`, `errors.ts`, `notes.ts`, `types.ts`) |
| Server prefetch + `HydrationBoundary` | `src/app/notes/(list)/page.tsx` |
| Infinite list (`useInfiniteQuery`) | `src/app/notes/_components/notes-list.tsx` |
| Create: optimistic, rollback, per-field errors | `src/app/notes/_components/use-create-note.ts`, `create-note-form.tsx` |
| Stats polled until they change | `src/app/notes/_components/notes-stats.tsx` |
| Note page: `generateMetadata`, `notFound()` | `src/app/notes/[id]/page.tsx`, `src/app/notes/load-note.ts` |
| `/api/*` → `API_URL` proxy | `src/app/api/[...path]/route.ts` |
| Body cap, request header allow-list | `src/lib/http/body-limit.ts`, `src/lib/http/forwarded-headers.ts` |
| Identity model (not implemented yet) | `docs/auth.md` |
| CSP, nonce, locale, request id | `src/proxy.ts`, `src/lib/security/` |
| Metadata, robots, sitemap, OG, icons, manifest, JSON-LD | `src/app/layout.tsx`, `src/app/{robots,sitemap,manifest}.ts`, `src/app/{opengraph-image,icon,apple-icon}.tsx`, `src/lib/seo/` |
| Locales | `src/i18n/` |
| UI components and tokens | `src/components/ui/`, `components.json`, `src/app/globals.css` |
| Env | `src/lib/env/` |
| Logs | `src/lib/logger.ts`, `src/instrumentation.ts` |
| 404 and errors | `src/app/not-found.tsx`, `error.tsx`, `global-error.tsx` |
| Mock API and e2e | `e2e/` (`servers.ts`: ports and budgets of the test servers) |

## How it works

**The API proxy is a route handler, not `rewrites`.** `rewrites` in `next.config.ts` are evaluated at build time, which would bake the API address into the image. The route handler reads `API_URL` at startup (one image for every environment), forwards the request id and an allow-list of headers, enforces the body cap and deadlines below, writes a log line and answers with a contract error when the API is down. The browser talks only to its own origin: no CORS, `connect-src 'self'` in the CSP. Only `/api/v1/*` is exposed. `src/proxy.ts` does not run for `/api`: for every request it matches, Next.js buffers the body (up to 10 MB) and waits for all of it before the route handler starts, which would defeat the cap and the body deadline.

**Headers to the API.** The proxy and `serverApi` forward `accept`, `accept-language`, `content-type`, `user-agent`, the request id, and `x-forwarded-for` set to the one address in `x-real-ip` (written by Traefik's `real-ip` middleware, so the API's per-client rate limit still sees the visitor). Everything else is dropped, `authorization`, `cookie`, the client's `x-forwarded-*` and `x-user-*` included. How a future version passes the user's identity: [docs/auth.md](docs/auth.md).

**Data.** Query options take the client as the first argument: Server Components pass `await serverApi()` (straight to `API_URL`), client components pass `browserApi` (through `/api`). Same key, same cache.

**Locale.** `?lang=en|ru` > `locale` cookie > `Accept-Language` > `en`. `?lang=` rewrites the cookie. `src/proxy.ts` picks the locale and the server renders `<html lang>`. Canonical is `/path?lang=<locale>`, hreflang lists both, `x-default` is the path without the parameter.

**UI and theme.** Components are shadcn/ui source in `src/components/ui/` (Radix primitives, `cn` from the `cn` package). One light palette: shadcn neutral tokens as CSS variables in `src/app/globals.css`. No theme switch, no `dark:` classes (a unit test rejects them, since components added later bring their own).

**CSP and styles.** Production `style-src` is `'self' 'nonce-…'` plus two hashes, without `unsafe-inline`. No component used here renders a `style` attribute on the server; Sonner's toasts set theirs in the browser through the DOM, which the CSP does not restrict. Sonner does inject its stylesheet as a `<style>` element at runtime, which cannot carry a nonce, so `src/lib/security/csp.ts` allows exactly that stylesheet (and the empty `<style>` it appends first) by SHA-256. A unit test recomputes the hash from `node_modules/sonner`, so a Sonner update that changes its CSS fails `pnpm verify` until the hash is updated; the e2e suite fails on any CSP violation.

**404.** A route that can answer 404 must not have a `loading.tsx` above it: a stream that has started has already sent 200. So the list's `loading.tsx` sits in the `(list)` group and `/notes/[id]` has none.

## Request limits and time budgets

From the [service runtime contract](https://github.com/nick-lukashik/.github/blob/master/docs/service-contract.md) (Request size, Time budgets).

| Limit | Value | Where | Answer |
|---|---|---|---|
| Request body through `/api` | 1 MiB | `MAX_BODY_BYTES` in `src/lib/http/body-limit.ts` | `413` |
| Reading that body | 10 s from the start of the request | `API_BODY_TIMEOUT_MS` | `408` |
| The API call | 10 s from the start of the request | `API_REQUEST_TIMEOUT_MS` (also for server-side calls) | `504` |
| API unreachable | | | `503` |
| Browser client (`browserApi`) | 12 s | `src/lib/api/client.ts` | `UNAVAILABLE` |

All answers carry the contract error body (`{ code, message, requestId }`; `VALIDATION_FAILED` for 4xx, `INTERNAL` for 5xx).

- A `Content-Length` over the cap is rejected before anything is read. Without one (chunked), the body runs through a counting `TransformStream` that errors on the first byte past 1 MiB.
- Both deadlines start when the handler starts, so a slow body cannot borrow time from the API call. The client going away aborts the API call too.
- The bounded body is buffered and then sent, rather than streamed to the API (`duplex: 'half'`): the API (body parser) needs the whole body before it can answer anyway, and buffering means the API never sees a partial or oversized body and a slow client never holds an API connection or uses up the API's own 10 s budget. At most 1 MiB per request is held in memory.
- What is left of a rejected body is read and discarded for up to 2 s, so the client gets the `413`/`408` instead of a connection reset; after that the connection is closed.
- The contract puts the same 1 MiB cap at the edge too (Traefik `body-limit` middleware, gitops); the proxy's own cap also holds in local runs and for anything that bypasses Traefik.

## Health semantics

| Probe | Answers | Body |
|---|---|---|
| `GET /health/live` | `200` while the process answers; reads no dependency | `{ status: 'ok', version }` |
| `GET /health/ready` | `200` when this server can render (it answered, its config parsed) | `{ status: 'ok' \| 'degraded', version, checks: { api: 'ok' \| 'down' } }` |

Readiness reports the API but does not require it (contract, kind web): with the API down, every web pod stays in the load balancer, pages that need no API keep working, and pages that need it show their own error state (the notes list shows an error with a retry button, a note page shows `error.tsx`). Taking the web out of rotation would turn an API outage into a whole-site outage. The API check has a 2 s timeout, below the probe's 3 s. Both probes return `x-app-version`, which the post-deploy smoke check waits for. The Docker `HEALTHCHECK` uses `/health/ready` with the same meaning.

## End-to-end against a real API

The bundled mock covers the contract; the `real-api` Playwright project runs the same notes specs (`e2e/notes.spec.ts`) against a real API, for example [`../nest-example`](https://github.com/nick-lukashik/nest-example). It starts one more server of the same build with `API_URL=$E2E_API_URL`; without `E2E_API_URL` its tests are skipped.

```bash
# terminal 1, in ../nest-example (see its README, "Getting started")
pnpm install
pnpm infra:up           # Postgres, Redis, RabbitMQ in Docker
pnpm env:local
pnpm db:migrate         # also builds dist/
# a first run on an empty database creates about 50 notes, over the default 30 per minute
RATE_LIMIT_PER_MINUTE=1000 pnpm start      # http://127.0.0.1:4000

# terminal 2, here
pnpm build
E2E_API_URL=http://127.0.0.1:4000 pnpm test:e2e:real
```

A real database keeps its data between runs, so the specs work with whatever is there: they create the notes they need through the API and read expected values from it. The one test that needs the mock's failure hook (`!fail`) is skipped. Stop the API afterwards and `pnpm infra:down` in `../nest-example` (`pnpm infra:reset` also deletes the data).

## Adding a page

1. `src/app/<path>/page.tsx`, a Server Component.
2. Text in `src/i18n/messages/en.json` and `ru.json` (same keys; a test checks it).
3. `generateMetadata` returns only `title` and `description` through `getTranslations`. The root layout adds canonical, hreflang and Open Graph.
4. Public page: add it to `src/app/sitemap.ts`.
5. Test: e2e in `e2e/`, with an axe check if it has new UI.

## Adding a request

1. The API's OpenAPI document changed: update `e2e/mock-api/openapi.json` (and the mock), then `pnpm api:types` (or `OPENAPI_URL=<url> pnpm api:types` against a running API).
2. Response type in `src/lib/api/types.ts` (by path and status from `schema.d.ts`).
3. In `src/lib/api/<resource>.ts`: endpoint (`api.request<T>(...)`), keys (`xxxKeys`), options (`queryOptions` / `infiniteQueryOptions`), client as the first argument.
4. Server: `await getServerQueryClient().query(xxxQueries.one(await serverApi())).catch(...)` and `HydrationBoundary`. Client: `useQuery(xxxQueries.one(browserApi))`.
5. Mutation: `useMutation` with `mutationKey`, then `invalidateQueries` on the resource keys after success.

## Environment variables

| Variable | Default | Read |
|---|---|---|
| `API_URL` | `http://localhost:4000` | at startup |
| `API_REQUEST_TIMEOUT_MS` | `10000` | at startup; every API call (server-side and the `/api` proxy) |
| `API_BODY_TIMEOUT_MS` | `10000` | at startup; reading a body the `/api` proxy forwards |
| `SITE_URL` | `http://localhost:3000` | at startup |
| `APP_VERSION` | `dev` | at startup (`x-app-version` header) |
| `LOG_LEVEL` | `info` | at startup |
| `ROBOTS` | `index` | per request; `noindex` blocks indexing (stage) |
| `GTM_ID` | none | per request; Google Tag Manager container (`GTM-ABC1234`). Unset: no tag manager, and the CSP stays on this origin. It loads only after the person agrees in the banner; the answer is `nl_consent`, on the whole domain |
| `OPENAPI_URL` | `e2e/mock-api/openapi.json` | by `pnpm api:types` only |

## Docker

```bash
docker build --build-arg APP_VERSION=$(git rev-parse HEAD) -t next-example .
docker run --rm -p 3000:3000 -e API_URL=http://host.docker.internal:4000 \
  -e SITE_URL=http://localhost:3000 next-example
# as in Kubernetes: read-only root filesystem, no capabilities
docker run --rm -p 3000:3000 --read-only --tmpfs /tmp --tmpfs /app/.next/cache \
  --cap-drop ALL --security-opt no-new-privileges --user 10001:10001 \
  -e API_URL=http://host.docker.internal:4000 -e ROBOTS=noindex next-example
```

Stages: `base` (Node image) → `deps` (pnpm, `pnpm install` with a cache mount) → `build` (`pnpm build`) → `runtime` (standalone output only). `APP_VERSION` is the only build arg: nothing environment-specific is baked in, so one image runs on stage and prod. App files are owned by root, the app runs as uid `10001` and may write only `/tmp` and `.next/cache` (mode `1777`, so a `--tmpfs` there is writable too). `HEALTHCHECK` runs `healthcheck.mjs` against `/health/ready`; Kubernetes ignores it and uses its probes. `node server.js` is PID 1 and exits on `SIGTERM` after in-flight requests finish.

## Dependency updates

Versions are pinned exactly. [Renovate](https://docs.renovatebot.com/) (`renovate.json`) opens PRs on Monday early morning (`Asia/Tbilisi`): one PR for all non-major updates, one per major, weekly lockfile maintenance. It covers npm packages, `packageManager`, `.node-version`, the Dockerfile base image tag, GitHub Actions (pinned by digest) and the `pnpm dlx` pins in `scripts/api-types.mjs`. Releases younger than 3 days are skipped, the same as pnpm's `minimumReleaseAge` in `pnpm-workspace.yaml`. Renovate needs the [Renovate GitHub app](https://github.com/apps/renovate) installed on the organization (or this repository). Check the config with `pnpm dlx --package renovate renovate-config-validator --strict`.

## CI

`.github/workflows/ci.yml` calls the org reusable workflows from `nick-lukashik/.github`:

- job `ci`: `build.yml@v1` with `kind: web` and `publish: false`. In one job it runs `pnpm verify`, then `pnpm test:e2e` on that same build (Playwright, the mock API, and more servers from the same build: `ROBOTS=noindex`, and one whose API is down; the `real-api` project is skipped without `E2E_API_URL`), then builds the image. Nothing is pushed and nothing is deployed. The required check is `ci / verify`.

The org workflows are referenced by the moving major tag `@v1`, never `@master` (breaking changes go to `v2`). Third-party actions are pinned by SHA.

## Deploy

This repo is never deployed. A site built from `next-starter` with the API part is, and follows the [service runtime contract](https://github.com/nick-lukashik/.github/blob/master/docs/service-contract.md) (kind **web**); the source of truth for everything below.

- Image: `ghcr.io/nick-lukashik/<repo-name>`, tags `sha-<7 chars>` and the full SHA, deployed by digest only. The same image goes to stage and then to prod.
- gitops: `apps/<svc>/prod/kustomization.yaml` includes `components/service` and `components/web`, sets the host, and has one `images:` entry `ghcr.io/nick-lukashik/<svc>` with a `digest` (no `newName`). The deploy PR changes only that digest.
- ConfigMap `<svc>-config` (via `envFrom`): `API_URL` (the API inside the cluster, `http://<api>.prod.svc`), `SITE_URL` (the public origin), `ROBOTS` (`index` on prod, `noindex` on stage). Optional: `API_REQUEST_TIMEOUT_MS`, `API_BODY_TIMEOUT_MS`, `LOG_LEVEL`. `PORT=3000` comes from gitops; `APP_VERSION` from the image. Secrets, if the app ever needs any, go to the SealedSecret `<svc>-secrets`.
- Probes: `/health/live` (the process answers, no API call) and `/health/ready` (this server can render; the API's state is in the body, not required, see [Health semantics](#health-semantics)). Both return `x-app-version`, which the post-deploy smoke check waits for.
- `components/web` adds the `/app/.next/cache` `emptyDir` (next to `/tmp`) and the `nick-lukashik.com/api-client: "true"` pod label the API's NetworkPolicy admits.

## Limitations

- One OG image, in English: link previews arrive without the locale cookie.
- `openapi-typescript` 7 does not work with TypeScript 7 (no JS API), so `pnpm api:types` runs it through `pnpm dlx` with TypeScript 5.9; the versions are pinned in `scripts/api-types.mjs`.
