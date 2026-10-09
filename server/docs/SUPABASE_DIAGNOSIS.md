# LabaRide Supabase connection verification

Verified on October 9, 2026. No secret values are included in this report.

## Root cause and findings

The previous saved credentials were rejected during `prisma.$connect()` with
`P1000`, before any SQL query could run. The Session pooler hostname, port,
project-scoped username, and database name matched the Supabase dashboard.
Both URLs were loaded from `server/.env`, had SSL enabled, contained an
alphanumeric password with valid encoding, and had no shell overrides.

After the user reset the password in Supabase and saved the new password in
`server/.env`, authentication and a real `SELECT 1` succeeded with the same
connection settings. This confirms the authentication blocker was external to
the application code. The error alone cannot distinguish an incorrect prior
password from stale pooler credentials after a rotation; the pooler-cache
explanation was a possibility, not a verified root cause.

A second issue prevented application queries: the public schema contained no
base tables or enum types, and the initial migration was pending. The reviewed
`20261009000000_init` migration was applied. It created eight application tables,
their foreign keys and unique indexes, the transaction status enum, and row level
security. No existing public tables or records were replaced.

## Connection configuration

- Prisma CLI and Client: **5.22.0**. The Prisma 5 schema configuration is retained;
  no newer-version `prisma.config.ts` was introduced.
- Runtime: `DATABASE_URL`, shared **Session pooler**, port **5432**.
- Migration CLI: `DIRECT_URL`, shared **Session pooler**, port **5432** for this
  machine. Earlier direct-host probes were unreachable (`P1001`), so using the
  IPv4-capable Session pooler is deliberate. The variables remain independently
  configurable for a deployment with working direct connectivity.
- Host: `aws-0-ap-northeast-2.pooler.supabase.com`.
- Username: `postgres.domftqrekdrimtulkvxf`; database: `postgres`.
- SSL: `sslmode=require`; connection timeout: 30 seconds. The backend supplies
  these defaults when absent; saved URLs retain them for Prisma CLI operations.
- One shared Prisma Client is used by all controllers, including authentication,
  user profiles, shops, transactions, and the readiness endpoint.
- Secrets are stored in ignored `server/.env`. Deployment variables keep their
  normal precedence over dotenv. Unrelated environment settings were preserved.

## Files changed in this diagnosis

| File | Purpose |
| --- | --- |
| `server/.env.example` | Remove the exposed database password and retain placeholders. |
| `server/src/config/env.ts` | Recognize supported password placeholders, report missing configuration, and validate SSL against the installed Prisma version. Secure defaults remain automatic. |
| `server/src/utils/database-error.ts` | Classify database failures with fixed, credential-safe messages. |
| `server/src/scripts/check-database.ts` | Test authentication, `SELECT 1`, and all eight tables; report safe errors and clean up the client. |
| `server/src/middleware/error.middleware.ts` | Return controlled database errors, including HTTP 503 for outages or incomplete schema, without exposing raw Prisma messages. |
| `server/src/server.ts` | Handle startup/listen failures and disconnect on SIGINT/SIGTERM with safe diagnostics. |
| `server/package.json` | Add the configuration and error-handling test command. |
| `server/tests/database.test.cjs` | Add six tests for configuration, independent URLs, error categories, and credential-safe API responses. |
| `server/docs/SUPABASE_SETUP.md` | Document the verified Session pooler setup, timeout, diagnostics, and password rotation. |
| `server/docs/SUPABASE_DIAGNOSIS.md` | Record the actual findings, changes, verification, and remaining actions. |

Existing integration changes from this conversation are retained: `.gitignore`
excludes environment files; `prisma/schema.prisma` uses separate runtime/migration
variables; `src/config/database.ts` explicitly uses the validated runtime URL;
`src/app.ts` provides database readiness; `README.md` documents startup; and the
initial migration plus `migration_lock.toml` provide the application schema.
No business models, controllers, or authentication flows were rewritten.

## Verification results

| Check | Actual result |
| --- | --- |
| `npx.cmd prisma validate` | Passed. |
| `npx.cmd prisma generate` | Passed; Client 5.22.0 generated. |
| `npm.cmd run test:database` | Build passed and all 6 tests passed. |
| `npm.cmd run prisma:deploy` | Initial migration applied successfully. |
| `npx.cmd prisma migrate status` | Database schema is up to date. |
| `npm.cmd run db:check` | Authentication succeeded, `SELECT 1` passed, all eight tables present. |
| Real backend startup | Connected to PostgreSQL and listened on temporary port 5087. |
| `GET /health` | HTTP 200; status `ok`. |
| `GET /health/ready` | HTTP 200; database `connected`. |
| `GET /api/shops` | HTTP 200; successful database query returned an empty shop list. |
| `GET /api/users/0` without a token | HTTP 401; authentication guard enforced. |

The HTTP checks used the real backend and Supabase connection. They did not
create accounts, shops, or orders. The temporary server was stopped after testing.
Configuration/error-handling tests exercise those local functions separately.

## Security and remaining actions

The old database password appeared in `.env.example` and the pasted chat selection.
The user rotated it in Supabase, and the new private password authenticated
successfully. `.env.example` now contains placeholders. Neither `server/.env` nor
`mobile/.env` is tracked by Git, and both are ignored. The JWT secret was not
exposed in the provided selection and was preserved.

No further database repair or migration is pending. Start the normal backend with
`npm.cmd run dev` from `server/`; it uses the configured port 5000. Start the web
app with `npm.cmd run web` from `mobile/`. Keep `EXPO_PUBLIC_API_URL` pointed at
the Express API. Signup and booking flows can be tested with user-created test
accounts; this diagnosis did not create business records.

References: [Supabase Prisma setup](https://supabase.com/docs/guides/database/prisma),
[authentication failures](https://supabase.com/docs/guides/troubleshooting/fatal-password-authentication-failed),
[password reset](https://supabase.com/docs/guides/troubleshooting/how-do-i-reset-my-supabase-database-password-oTs5sB),
and [pooler password rotation](https://supabase.com/docs/guides/troubleshooting/supavisor-error-password-authentication-failed-after-password-rotation).
