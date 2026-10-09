# LabaRide 2.0 (Migration Project)

This project is a complete migration of the LabaRide application from Flutter/Flask/MySQL to a modern React Native (Expo) and Node.js (Express/Prisma/PostgreSQL) stack.

## Architecture

```
LabaRide/
├── mobile/         # React Native + Expo (TypeScript)
│   ├── app/        # Expo Router (Screens)
│   ├── src/        # Shared logic, API client, State (Zustand)
│   └── package.json
│
└── server/         # Node.js + Express (TypeScript)
    ├── prisma/     # PostgreSQL Schema & Migrations
    ├── src/        # Controllers, Routes, Sockets
    └── package.json
```

## Prerequisites
- Node.js 24.19.0 (the mobile app uses Expo SDK 57)
- A Supabase project and its database password (or a local PostgreSQL server)
- Expo CLI

## Installation & Setup

### 1. Database (Supabase)
The backend uses Prisma to connect to Supabase PostgreSQL. The mobile app calls
the Express API; database credentials stay in `server/.env`.

The environment template is configured for project `domftqrekdrimtulkvxf`.
Follow [the Supabase setup guide](server/docs/SUPABASE_SETUP.md) to set the
database password, deploy the tables, and verify the connection.

### 2. Backend (Server)
```bash
cd server
npm install

# Configure your environment variables
# Copy .env.example to .env if it does not exist, then set the database URLs
# and a random JWT_SECRET. Never overwrite an existing configured .env.

# Deploy the initial migration to a new database (no shadow database needed)
npm run prisma:generate
npm run prisma:deploy
npm run db:check

# Start the server
npm run dev
```

### 3. Frontend (Mobile)
```bash
cd mobile
npm install

# Copy .env.example to .env and set EXPO_PUBLIC_API_URL to your backend URL

# Start the Expo development server
npx expo start
```

The mobile app supports Node.js 24. In PowerShell, use `npm.cmd install` and
`npx.cmd expo start` if `.ps1` script execution is disabled.

## Migration Notes

The original Flutter screen designs and assets are recreated in `mobile/src/design`
and `mobile/assets/flutter`. See [the screen migration map](mobile/docs/FLUTTER_DESIGN_MIGRATION.md)
for all 74 source design files, React Native routes, and API support. Captured mobile
screen previews are in `mobile/artifacts/design-preview`.

- **Data Transfer:** See `MIGRATION_DATA.md` (in the `server/` directory or your IDE artifacts) for the SQL script necessary to migrate data from the legacy MySQL database.
- **Authentication:** Sessions are now handled via secure JWTs stored in `expo-secure-store` managed by Zustand.
- **Sockets:** Real-time transaction tracking is preserved using `socket.io-client` mapped to the Express server.
