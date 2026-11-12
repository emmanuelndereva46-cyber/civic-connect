
import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../../generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is missing from the .env file.");
}

const url = new URL(databaseUrl);

const adapter = new PrismaMariaDb({
  host: "127.0.0.1",
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.replace(/^\//, ""),
  allowPublicKeyRetrieval: true,
  connectionLimit: 5,
  connectTimeout: 5000,
  acquireTimeout: 10000
});

export const prisma = new PrismaClient({ adapter });
