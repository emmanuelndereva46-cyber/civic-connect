
import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../../generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL;
const caPath = process.env.TIDB_CA_CERT_PATH;

if (!databaseUrl || !caPath) {
  throw new Error("DATABASE_URL or TIDB_CA_CERT_PATH is missing.");
}

const url = new URL(databaseUrl);

const adapter = new PrismaMariaDb({
  host: url.hostname,
  port: Number(url.port || 4000),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: decodeURIComponent(url.pathname.slice(1)),
  ssl: {
    ca: readFileSync(caPath, "utf8"),
  },
  connectionLimit: 5,
  connectTimeout: 10000,
  acquireTimeout: 10000,
});

export const prisma = new PrismaClient({ adapter });
