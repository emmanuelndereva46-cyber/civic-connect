export default function Home() {
  return (
    <main style={{ fontFamily: 'system-ui', maxWidth: 720, margin: '4rem auto', padding: '0 1rem', lineHeight: 1.6 }}>
      <h1>CivicConnect TiDB Inspector</h1>
      <p>Private, read-only Model Context Protocol server for diagnosing the CivicConnect database.</p>
      <p>Health endpoint: <a href="/api/health">/api/health</a></p>
      <p>MCP endpoint: <code>/api/mcp</code> (requires a bearer token).</p>
      <p>No database contents are exposed by this page.</p>
    </main>
  );
}
