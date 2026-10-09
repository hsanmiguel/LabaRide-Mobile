# Supabase database setup

LabaRide uses this data path: Expo app → Express API → Prisma → Supabase Postgres.
The existing bcrypt/JWT login uses the `public.users` table. No Supabase API key
or Supabase Auth integration is needed for this connection.

## Configure the backend

Use `server/.env`. If it does not exist, copy `server/.env.example` to it.
The local file created during setup already contains a random JWT secret.

The verified configuration for this Windows machine uses the shared Session
pooler on port 5432 for both runtime and migrations. Its host is
`aws-0-ap-northeast-2.pooler.supabase.com` and its username is
`postgres.domftqrekdrimtulkvxf`. Keep actual passwords in `.env` only.

1. Open [the project's Connect dialog](https://supabase.com/dashboard/project/domftqrekdrimtulkvxf?showConnect=true).
2. Replace `[YOUR-PASSWORD]` in both `DATABASE_URL` and `DIRECT_URL` with the
   project's database password. URL-encode special characters in the password
   (for example, `@` becomes `%40`, `#` becomes `%23`, and `%` becomes `%25`).
   This is the database password, not your Supabase account password or API key.
3. Keep `sslmode=require`, `schema=public`, and `connect_timeout=30` in the URLs.
   The backend and `db:check` automatically add SSL and a 30-second connection
   timeout when those parameters are missing from a Supabase URL. Prisma CLI
   migrations read `.env` directly, so keep the parameters in the saved file too.
4. If creating a new `.env` from the template, generate `JWT_SECRET` with
   `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
   Use the same JWT secret across backend instances.

The supplied direct URL is:

```dotenv
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.domftqrekdrimtulkvxf.supabase.co:5432/postgres?sslmode=require&schema=public&connect_timeout=30"
DIRECT_URL="postgresql://postgres:[YOUR-PASSWORD]@db.domftqrekdrimtulkvxf.supabase.co:5432/postgres?sslmode=require&schema=public&connect_timeout=30"
```

Supabase's direct host normally requires IPv6. If it is unreachable from your
network, copy the **Session pooler** connection string from the Connect dialog
and use it for both variables. It uses port **5432**, a username such as
`postgres.domftqrekdrimtulkvxf`, and the dashboard's exact pooler host. Keep the
SSL parameters. Do not guess the pooler's region or hostname.

For a future transaction pooler setup, `DATABASE_URL` may use port 6543 with
`pgbouncer=true`. `DIRECT_URL` must remain a direct or session pooler connection
on port 5432 for migrations. These settings match the project's Prisma 5 client.

## Create tables and verify

From `server/`, run (use `npm.cmd` in PowerShell if required):

```bash
npm install
npm run prisma:generate
npm run prisma:deploy
npm run db:check
npm run dev
```

The initial migration creates the eight app tables, their relationships, unique
indexes, and the transaction status enum. It enables row level security without
public policies, so the app accesses data through the privileged backend role
(`postgres` in the supplied URL). Keep that role and its password on the server.

`prisma:deploy` applies checked-in migrations without creating a shadow database.
Use it for the hosted Supabase project. `prisma:migrate` is for creating future
migrations in a separate development database.

If the project already has LabaRide tables or data, inspect and compare the
existing schema before deploying the initial migration. Baseline only a schema
that matches this migration; do not reset the hosted database.

`db:check` checks connectivity and the presence of all eight tables without
changing data. `/health` checks the HTTP server; `/health/ready` runs `SELECT 1`
and returns HTTP 200 when the database is reachable, or 503 when it is unavailable.
Live connection and table compatibility must be verified with real credentials.

Configuration errors identify missing fields without printing their values.
The database check distinguishes authentication failure (`P1000`), an unreachable
server (`P1001`), TLS failures, timeouts, and missing tables. API database outages
return controlled HTTP 503 responses; raw Prisma error text is not returned or logged.

If authentication fails after a password reset, update both URLs in `.env` with
the newest password and retry after allowing the pooler credential cache to refresh.
Changing `.env.example` does not change the running backend configuration. Passwords
exposed in a chat, a template, or a repository must be rotated in Supabase's
Database > Settings, then updated in `.env` and any deployment secret store.

Run the configuration and error-handling tests with `npm run test:database`.

## Connect the mobile app

Copy `mobile/.env.example` to `mobile/.env` if needed and set
`EXPO_PUBLIC_API_URL` to the Express server, for example:

```dotenv
EXPO_PUBLIC_API_URL=http://localhost:5000
```

Use your computer's LAN address for a physical phone or `http://10.0.2.2:5000`
for an Android emulator. Restart Expo after changing its environment variables.
Use the deployed HTTPS backend URL for a hosted app. Never place a PostgreSQL
URL or database password in an `EXPO_PUBLIC_*` variable.

References: [Supabase Prisma guide](https://supabase.com/docs/guides/database/prisma),
[database connections](https://supabase.com/docs/guides/database/connecting-to-postgres),
and [row level security](https://supabase.com/docs/guides/database/postgres/row-level-security).
