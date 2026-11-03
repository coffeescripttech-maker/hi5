import mysql, { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import dotenv from "dotenv";
import path from "path";

// Load .env from server root
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const pool: Pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306"),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "hi5_portal",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10_000,
  // The managed MySQL sits behind a TCP proxy that silently drops sockets that
  // have been idle for a few minutes. Keep only a couple of warm sockets and
  // close any idle one below the proxy's drop window, so a request never gets
  // handed a long-dead connection.
  maxIdle: 3,
  idleTimeout: 30_000,
  // Return DATE columns as plain "YYYY-MM-DD" strings instead of JS Dates.
  // A DATE is a calendar date with no time / timezone; mysql2's default decodes
  // it to a local-midnight Date that JSON-serializes to a UTC-shifted ISO string
  // (e.g. 2018-03-05 -> "2018-03-04T16:00:00.000Z" in UTC+8), which both shows
  // the wrong day and is rejected by MySQL when posted back. dateStrings keeps
  // the round-trip lossless. DATETIME/TIMESTAMP columns are unaffected.
  dateStrings: ["DATE"],
  // Return DECIMAL/NEWDECIMAL columns as JS numbers instead of strings. mysql2's
  // default decodes DECIMAL to a string ("4.000000000000"), which breaks any
  // arithmetic on the client ("a + hours" becomes string concatenation) and
  // prints raw DB formatting in the UI. Every DECIMAL in this schema is small
  // (hours, grades, averages), well inside Number's safe range, so the
  // conversion is lossless for our data.
  decimalNumbers: true,
  // TLS for a remote managed MySQL (Railway/cloud): DB_SSL=require.
  ssl: process.env.DB_SSL === "require" ? { rejectUnauthorized: false } : undefined,
  // The managed MySQL sits behind a TCP proxy that silently drops sockets that
  // have been idle for a few minutes. Without keep-alive those dead sockets
  // stay in the pool, so the first requests after an idle period fail with
  // ECONNRESET ("Failed to fetch ...") until every stale socket is evicted.
  enableKeepAlive: true,
  keepAliveInitialDelay: 10_000,
});

/** Connection-level failures that mean "that socket is gone", not "that query is wrong". */
function isConnectionLoss(error: unknown): boolean {
  const code = (error as { code?: string })?.code || "";
  return (
    (error as { fatal?: boolean })?.fatal === true ||
    ["ECONNRESET", "EPIPE", "ETIMEDOUT", "ECONNREFUSED", "PROTOCOL_CONNECTION_LOST", "PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR"].includes(code)
  );
}

/** Only read statements may be retried — a retried write could be applied twice. */
function isReadOnly(sql: string): boolean {
  return /^\s*(select|show|describe|desc|explain|with)\b/i.test(sql);
}

/**
 * A black-holed socket (the TCP proxy dropped it without sending RST) makes an
 * in-flight query wait forever: the HTTP request hangs and one of the few pool
 * slots is burnt indefinitely, so later requests starve. This watchdog turns
 * that into a fast error, and the stalled connection is DESTROYED (not
 * released) so mysql2 evicts it instead of corrupting the next request.
 */
const QUERY_WATCHDOG_MS = Number(process.env.DB_QUERY_TIMEOUT_MS) || 120_000;

class QueryWatchdogError extends Error {
  code = "ETIMEDOUT_QUIESCE";
  fatal = true;
}

/**
 * Execute a query with params
 */
export async function query<T extends RowDataPacket[] | ResultSetHeader>(
  sql: string,
  params?: any[]
): Promise<T> {
  const conn = await pool.getConnection();
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  const race = async (): Promise<[T, unknown]> => {
    const exec = conn.execute<T>(sql, params);
    const tick = new Promise<never>((_, reject) => {
      watchdog = setTimeout(
        () => reject(new QueryWatchdogError(`Query stalled >${QUERY_WATCHDOG_MS}ms: ${sql.slice(0, 90)}`)),
        QUERY_WATCHDOG_MS
      );
    });
    return Promise.race([exec, tick]) as Promise<[T, unknown]>;
  };
  try {
    const [rows] = await race();
    clearTimeout(watchdog);
    conn.release();
    return rows;
  } catch (error) {
    clearTimeout(watchdog);
    if (error instanceof QueryWatchdogError) {
      // The socket is stalled beyond saving — remove it from the pool.
      conn.destroy();
    } else {
      conn.release();
    }
    // A dropped pooled socket is transient; mysql2 already evicted it, so one
    // retry lands on a fresh connection. Writes surface the error instead of
    // risking a double-apply.
    if (isConnectionLoss(error) && isReadOnly(sql)) {
      const conn2 = await pool.getConnection();
      try {
        const [rows] = await conn2.execute<T>(sql, params);
        conn2.release();
        return rows;
      } catch (retryError) {
        if (isConnectionLoss(retryError)) conn2.destroy();
        else conn2.release();
        throw retryError;
      }
    }
    throw error;
  }
}

/**
 * Get a connection from the pool (for transactions)
 */
export async function getConnection(): Promise<PoolConnection> {
  return pool.getConnection();
}

/**
 * Test database connectivity
 */
export async function testConnection(): Promise<boolean> {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    console.log("✅ Database connected successfully");
    return true;
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    return false;
  }
}

export default pool;
