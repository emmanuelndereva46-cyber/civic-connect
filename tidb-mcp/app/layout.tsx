import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'CivicConnect TiDB Inspector',
  description: 'Read-only MCP diagnostics for the CivicConnect TiDB database.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
