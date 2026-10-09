import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'node:path';

// Works when invoked from either the repository root or the server directory.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const databaseUrl = z.string().transform((value) => {
  try {
    const url = new URL(value);
    if (url.hostname.endsWith('.supabase.co') || url.hostname.endsWith('.pooler.supabase.com')) {
      // Supabase's copied URI omits options needed by this backend.
      let changed = false;
      if (!url.searchParams.has('sslmode')) {
        url.searchParams.set('sslmode', 'require');
        changed = true;
      }
      if (!url.searchParams.has('connect_timeout')) {
        url.searchParams.set('connect_timeout', '30');
        changed = true;
      }
      if (changed) return url.toString();
    }
  } catch {
    // Report malformed URLs through the validation below.
  }
  return value;
}).superRefine((value, ctx) => {
  try {
    const url = new URL(value);
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || url.pathname.length < 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Use a complete PostgreSQL connection URL.' });
    }
    if (['[YOUR-PASSWORD]', '[DATABASE_PASSWORD]'].includes(decodeURIComponent(url.password))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Replace [YOUR-PASSWORD] in server/.env with your URL-encoded database password.' });
    }
    if (url.hostname.endsWith('.supabase.co') || url.hostname.endsWith('.pooler.supabase.com')) {
      if (!url.password) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'The Supabase database password is required.' });
      }
      if (url.searchParams.get('sslmode') !== 'require') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Add sslmode=require to the Supabase connection URL.' });
      }
    }
  } catch {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Use a valid PostgreSQL connection URL; URL-encode special characters in the password.' });
  }
});

export const envSchema = z.object({
  PORT: z.string().default('5001'),
  DATABASE_URL: databaseUrl,
  DIRECT_URL: databaseUrl.optional(),
  JWT_SECRET: z.string().min(32, 'Set JWT_SECRET to a random secret of at least 32 characters.'),
  CORS_ORIGIN: z.string().default('*'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  const missing = _env.error.issues
    .filter((issue) => issue.code === 'invalid_type' && issue.received === 'undefined')
    .map((issue) => issue.path.join('.'));
  if (missing.length) console.error(`Missing required backend configuration: ${missing.join(', ')}.`);
  console.error('Invalid backend configuration:', _env.error.format());
  process.exit(1);
}

export const env = _env.data;
