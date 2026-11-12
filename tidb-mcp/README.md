# CivicConnect TiDB Inspector

Private, read-only MCP server for diagnosing the CivicConnect TiDB Cloud database. It is separate from the production API.

## Security

- MCP requests require an Authorization Bearer token.
- Use a dedicated TiDB account with SELECT and SHOW VIEW only. Never use the application's database account.
- TLS certificate verification is enabled. Supply the TiDB CA PEM as TIDB_SSL_CA if required by your cluster.
- SQL tool accepts one SELECT statement and caps output at 100 rows. Other tools inspect metadata and grants.
- Rotate credentials immediately if exposed.

## Environment variables

Set these in the separate Vercel project, initially for Production only:

| Variable | Description |
|---|---|
| TIDB_HOST | Hostname from TiDB Cloud Public Endpoint |
| TIDB_PORT | Port shown in TiDB connection details (commonly 4000) |
| TIDB_USER | Dedicated read-only account |
| TIDB_PASSWORD | Its password |
| TIDB_DATABASE | CivicConnect database/schema |
| TIDB_SSL_CA | Optional TiDB CA certificate PEM, encrypted |
| MCP_BEARER_TOKEN | Long random MCP access token |

Never commit secrets or paste them into chat.

## Create a dedicated read-only TiDB account

Run in TiDB SQL editor using an administrator account. Choose a unique strong password locally; do not send it to anyone. Replace the database name if yours differs:

\`\`\`sql
CREATE USER 'cc_inspector'@'%' IDENTIFIED BY 'REPLACE_WITH_A_LONG_RANDOM_PASSWORD';
GRANT SELECT, SHOW VIEW ON civicconnect.* TO 'cc_inspector'@'%';
SHOW GRANTS FOR 'cc_inspector'@'%';
\`\`\`

If the account exists, inspect its grants rather than creating it again. The wildcard host supports managed serverless egress; use a strong unique password and minimum privileges. If network access controls are enabled, configure them using TiDB's supported policy; do not rely on one ephemeral function IP.

## Local development

Requires Node.js 20+.

\`\`\`powershell
cd tidb-mcp
npm install
Copy-Item .env.example .env.local
npm run dev
\`\`\`

## MCP endpoint

After deployment: https://YOUR-VERCEL-DOMAIN/api/mcp

Example Cursor configuration:

\`\`\`json
{
  "mcpServers": {
    "civicconnect-tidb-inspector": {
      "url": "https://YOUR-VERCEL-DOMAIN/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_MCP_BEARER_TOKEN"
      }
    }
  }
}
\`\`\`

## Tools

- test_connection
- get_database_info
- list_tables
- describe_table
- check_user_permissions
- run_readonly_query

The inspector does not create, update, or delete database records.
