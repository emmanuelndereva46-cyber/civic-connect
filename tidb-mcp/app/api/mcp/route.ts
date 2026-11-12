import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import { getPool, safeError } from '@/lib/db';
import { isAuthorized } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handler = createMcpHandler((server) => {
  server.registerTool('test_connection', {
    title: 'Test TiDB connection',
    description: 'Check connectivity and return server/database identity without exposing credentials.',
    inputSchema: z.object({}),
  }, async () => {
    try {
      const [rows] = await getPool().query('SELECT DATABASE() AS database_name, VERSION() AS server_version, CURRENT_USER() AS authenticated_user');
      return { content: [{ type: 'text', text: JSON.stringify(rows) }] };
    } catch (error) { return { isError: true, content: [{ type: 'text', text: safeError(error) }] }; }
  });

  server.registerTool('get_database_info', {
    title: 'Get database information',
    description: 'Read database name, server version, current account, and connection character set.',
    inputSchema: z.object({}),
  }, async () => {
    try {
      const [rows] = await getPool().query('SELECT DATABASE() AS database_name, VERSION() AS server_version, CURRENT_USER() AS authenticated_user, @@character_set_connection AS connection_charset');
      return { content: [{ type: 'text', text: JSON.stringify(rows) }] };
    } catch (error) { return { isError: true, content: [{ type: 'text', text: safeError(error) }] }; }
  });

  server.registerTool('list_tables', {
    title: 'List database tables',
    description: 'List base tables and views in the configured database.',
    inputSchema: z.object({}),
  }, async () => {
    try {
      const [rows] = await getPool().execute('SELECT TABLE_NAME AS table_name, TABLE_TYPE AS table_type FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME');
      return { content: [{ type: 'text', text: JSON.stringify(rows) }] };
    } catch (error) { return { isError: true, content: [{ type: 'text', text: safeError(error) }] }; }
  });

  server.registerTool('describe_table', {
    title: 'Describe a table',
    description: 'Read column definitions and key metadata without reading table rows.',
    inputSchema: z.object({ table: z.string().min(1).max(64).regex(/^[A-Za-z0-9_]+$/) }),
  }, async ({ table }) => {
    try {
      const [rows] = await getPool().execute(
        'SELECT COLUMN_NAME AS column_name, COLUMN_TYPE AS column_type, IS_NULLABLE AS is_nullable, COLUMN_KEY AS column_key, COLUMN_DEFAULT AS column_default, EXTRA AS extra FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION',
        [table]
      );
      return { content: [{ type: 'text', text: JSON.stringify(rows) }] };
    } catch (error) { return { isError: true, content: [{ type: 'text', text: safeError(error) }] }; }
  });

  server.registerTool('check_user_permissions', {
    title: 'Check database permissions',
    description: 'Show the authenticated database identity and its grants.',
    inputSchema: z.object({}),
  }, async () => {
    try {
      const [identity] = await getPool().query('SELECT CURRENT_USER() AS authenticated_user, USER() AS connected_as');
      const [grants] = await getPool().query('SHOW GRANTS');
      return { content: [{ type: 'text', text: JSON.stringify({ identity, grants }) }] };
    } catch (error) { return { isError: true, content: [{ type: 'text', text: safeError(error) }] }; }
  });

  server.registerTool('run_readonly_query', {
    title: 'Run a read-only SELECT query',
    description: 'Run one SELECT statement, limited to at most 100 rows. The database account must also have read-only grants.',
    inputSchema: z.object({ sql: z.string().min(7).max(4000), max_rows: z.number().int().min(1).max(100).default(50) }),
  }, async ({ sql, max_rows }) => {
    const normalized = sql.trim();
    const forbidden = /\b(insert|update|delete|replace|drop|alter|create|truncate|grant|revoke|call|execute|prepare|deallocate|load|outfile|dumpfile|lock|unlock|set|use|kill|shutdown|flush|reset|analyze|optimize|repair)\b/i;
    if (!/^select\b/i.test(normalized) || /;|--|#|\/\*|\*\//.test(normalized) || forbidden.test(normalized)) {
      return { isError: true, content: [{ type: 'text', text: 'Rejected: only one SELECT statement without comments or write/administrative keywords is permitted.' }] };
    }
    try {
      const [rows] = await getPool().query(\`SELECT * FROM (\${normalized}) AS _cc_readonly_result LIMIT ?\`, [max_rows]);
      return { content: [{ type: 'text', text: JSON.stringify({ row_count: (rows as unknown[]).length, rows }) }] };
    } catch (error) { return { isError: true, content: [{ type: 'text', text: safeError(error) }] }; }
  });
}, { serverInfo: { name: 'civicconnect-tidb-inspector', version: '1.0.0' } });

async function authorized(req: Request) {
  if (isAuthorized(req.headers.get('authorization'))) return handler(req);
  return new Response('Unauthorized', { status: 401, headers: { 'WWW-Authenticate': 'Bearer', 'Cache-Control': 'no-store' } });
}

export const GET = authorized;
export const POST = authorized;
