
import "dotenv/config";
import mariadb from "mariadb";

const u = new URL(process.env.DATABASE_URL);

const pool = mariadb.createPool({
  host: "127.0.0.1",
  port: 3306,
  user: decodeURIComponent(u.username),
  password: decodeURIComponent(u.password),
  database: "civicconnect",
allowPublicKeyRetrieval: true,
  connectionLimit: 1,
  connectTimeout: 5000,
  acquireTimeout: 10000,
  initializationTimeout: 5000
});

pool.on("error", (error) => {
  console.error("POOL ERROR:", error.code);
  console.error("DETAILS:", error.message);
  console.error("SQL STATE:", error.sqlState);
});

try {
  const connection = await pool.getConnection();
  console.log("CONNECTED SUCCESSFULLY");
  console.log(await connection.query("SELECT 1 AS ok"));
  connection.release();
} catch (error) {
  console.error("CONNECTION FAILED");
  console.error("CODE:", error.code);
  console.error("DETAILS:", error.message);
  console.error("SQL STATE:", error.sqlState);
  if (error.cause) {
    console.error("CAUSE:", error.cause.message);
  }
} finally {
  await pool.end();
}
