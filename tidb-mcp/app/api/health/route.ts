import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  const required = ['TIDB_HOST', 'TIDB_USER', 'TIDB_PASSWORD', 'TIDB_DATABASE', 'MCP_BEARER_TOKEN'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    return NextResponse.json({ status: 'needs_configuration', missing }, { status: 503 });
  }
  try {
    const [rows] = await getPool().query('SELECT 1 AS ok');
    return NextResponse.json({ status: 'ok', database_connection: 'connected', check: rows });
  } catch (error) {
    const e = error as { code?: string; message?: string };
    return NextResponse.json({ status: 'database_error', code: e.code ?? 'UNKNOWN', message: safeMessage(e.message) }, { status: 503 });
  }
}

function safeMessage(message?: string) {
  return (message ?? 'Connection failed').replace(/(password|pwd)=([^&\s]+)/gi, '$1=[redacted]').slice(0, 240);
}
