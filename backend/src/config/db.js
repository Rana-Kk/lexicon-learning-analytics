import mysql from 'mysql2/promise'
import 'dotenv/config'

// A pool, not a single connection: Express handles many requests concurrently,
// each query borrows a connection and returns it when done.
export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true, // return DATE/TIMESTAMP as strings, not JS Date objects
})

export async function testConnection() {
  const conn = await pool.getConnection()
  try {
    await conn.query('SELECT 1')
  } finally {
    conn.release()
  }
}
