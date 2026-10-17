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
  // Return DATE columns as plain "YYYY-MM-DD" strings instead of JS Dates.
  // A DATE is a calendar date with no time / timezone; mysql2's default decodes
  // it to a local-midnight Date that JSON-serializes to a UTC-shifted ISO string
  // (e.g. 2018-03-05 -> "2018-03-04T16:00:00.000Z" in UTC+8), which both shows
  // the wrong day and is rejected by MySQL when posted back. dateStrings keeps
  // the round-trip lossless. DATETIME/TIMESTAMP columns are unaffected.
  dateStrings: ["DATE"],
  // TLS for a remote managed MySQL (Railway/cloud): DB_SSL=require.
  ssl: process.env.DB_SSL === "require" ? { rejectUnauthorized: false } : undefined,
});

/**
 * Execute a query with params
 */
export async function query<T extends RowDataPacket[] | ResultSetHeader>(
  sql: string,
  params?: any[]
): Promise<T> {
  const [rows] = await pool.execute<T>(sql, params);
  return rows;
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
