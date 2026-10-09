// Return fixed diagnostics: Prisma messages can include query input or credentials.
export function describeDatabaseError(error: unknown) {
  const details = error && typeof error === 'object'
    ? error as { name?: unknown; errorCode?: unknown; code?: unknown; message?: unknown }
    : {};
  const candidate = details.errorCode || details.code;
  const code = typeof candidate === 'string' && /^P\d{4}$/.test(candidate) ? candidate : 'UNKNOWN';
  const isDatabaseError = code !== 'UNKNOWN'
    || (typeof details.name === 'string' && details.name.startsWith('PrismaClient'));

  if (code === 'P1000') {
    return { code, isDatabaseError, status: 503, apiCode: 'DATABASE_UNAVAILABLE',
      message: 'Database authentication failed. Verify the database password and connection username.' };
  }
  if (code === 'P1001') {
    return { code, isDatabaseError, status: 503, apiCode: 'DATABASE_UNAVAILABLE',
      message: 'The database server is unreachable. Check project status, the connection host, and network access.' };
  }
  if (['P1002', 'P1008', 'P2024'].includes(code)) {
    return { code, isDatabaseError, status: 503, apiCode: 'DATABASE_UNAVAILABLE',
      message: 'The database connection or request timed out.' };
  }
  if (code === 'P1011' || (typeof details.message === 'string' && /TLS|security package/i.test(details.message))) {
    return { code, isDatabaseError, status: 503, apiCode: 'DATABASE_UNAVAILABLE',
      message: 'The database TLS connection failed. Check SSL configuration and the operating system TLS environment.' };
  }
  if (code === 'P1017') {
    return { code, isDatabaseError, status: 503, apiCode: 'DATABASE_UNAVAILABLE',
      message: 'The database closed the connection. Retry after checking database availability.' };
  }
  if (['P1012', 'P1013'].includes(code)) {
    return { code, isDatabaseError, status: 503, apiCode: 'DATABASE_UNAVAILABLE',
      message: 'The database configuration is invalid. Check the environment settings and Prisma schema.' };
  }
  if (['P2021', 'P2022'].includes(code)) {
    return { code, isDatabaseError, status: 503, apiCode: 'DATABASE_SCHEMA_NOT_READY',
      message: 'The database schema is incomplete or incompatible. Check migration status.' };
  }
  if (code === 'P2002') {
    return { code, isDatabaseError, status: 409, apiCode: 'CONFLICT', message: 'A record with these unique fields already exists.' };
  }
  if (code === 'P2025') {
    return { code, isDatabaseError, status: 404, apiCode: 'NOT_FOUND', message: 'The requested record was not found.' };
  }
  return { code, isDatabaseError, status: 500, apiCode: 'DATABASE_ERROR', message: 'The database request failed.' };
}
