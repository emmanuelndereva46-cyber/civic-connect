import mysql, { type Pool } from 'mysql2/promise';

let pool: Pool | undefined;

export function getPool(): Pool {
  if (pool) return pool;
  const { TIDB_HOST: host, TIDB_USER: user, TIDB_PASSWORD: password, TIDB_DATABASE: database } = process.env;
  if (!host || !user || !password || !database) throw new Error('Missing required TiDB connection settings.');
  const ca = process.env.TIDB_SSL_CA?.replace(/\\n/g, '\n');
  pool = mysql.createPool({
    host, port: Number(process.env.TIDB_PORT || 4000), user, password, database,
    waitForConnections: true, connectionLimit: 2, queueLimit: 5, connectTimeout: 10000,
    enableKeepAlive: true, ssl: { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
    multipleStatements: false, namedPlaceholders: false,
  });
  return pool;
}

export function safeError(error: unknown): string {
  const e = error as { code?: string; errno?: number; message?: string };
  return [e.code, e.errno ? String(e.errno) : undefined, e.message]
    .filter(Boolean).join(': ').replace(/(password|pwd)=([^&\\s]+)/gi, '$1=[redacted]').slice(0, 300);
}
