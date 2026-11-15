import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const required = ['TIDB_HOST', 'TIDB_USER', 'TIDB_PASSWORD', 'TIDB_DATABASE', 'MCP_BEARER_TOKEN'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    return NextResponse.json({ status: 'needs_configuration', missing }, { status: 503 });
  }
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT 1 AS ok');
    if (request.nextUrl.searchParams.get('include_schema') === '1') {
      const [schema] = await pool.query(
        'SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name, COLUMN_TYPE AS column_type, IS_NULLABLE AS is_nullable, COLUMN_DEFAULT AS column_default, COLUMN_KEY AS column_key, EXTRA AS extra FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME, ORDINAL_POSITION'
      );
      return NextResponse.json({ status: 'ok', database_connection: 'connected', check: rows, schema });
    }
    return NextResponse.json({ status: 'ok', database_connection: 'connected', check: rows });
  } catch (error) {
    const e = error as { code?: string; message?: string };
    return NextResponse.json({ status: 'database_error', code: e.code ?? 'UNKNOWN', message: safeMessage(e.message) }, { status: 503 });
  }
}

function safeMessage(message?: string) {
  return (message ?? 'Connection failed').replace(/(password|pwd)=([^&\\s]+)/gi, '$1=[redacted]').slice(0, 240);
}
