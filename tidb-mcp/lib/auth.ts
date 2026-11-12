import { timingSafeEqual } from 'node:crypto';

export function isAuthorized(header: string | null): boolean {
  const expected = process.env.MCP_BEARER_TOKEN;
  if (!expected || !header?.startsWith('Bearer ')) return false;
  const a = Buffer.from(header.slice(7));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
