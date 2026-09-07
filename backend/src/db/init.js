// Loads schema_v2.sql into MySQL. Run once: `npm run db:init`
// Executes each statement separately (instead of one multi-statement blob)
// so that if something fails, you see exactly which CREATE TABLE / INDEX
// caused it, instead of one opaque error for the whole file.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'
import 'dotenv/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function splitStatements(sql) {
  return sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--')) // strip full-line comments
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

async function main() {
  const sqlPath = path.join(__dirname, 'schema_v2.sql')
  const sql = fs.readFileSync(sqlPath, 'utf8')
  const statements = splitStatements(sql)

  console.log(`Found ${statements.length} statements. Connecting to MySQL...`)

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  })
  console.log('Connected.')

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i]
    const preview = stmt.replace(/\s+/g, ' ').slice(0, 70)
    try {
      await connection.query(stmt)
      console.log(`[${i + 1}/${statements.length}] OK  ${preview}`)
    } catch (err) {
      console.error(`[${i + 1}/${statements.length}] FAILED  ${preview}`)
      console.error('  code:', err.code)
      console.error('  sqlMessage:', err.sqlMessage)
      await connection.end()
      process.exit(1)
    }
  }

  console.log('Done. Database "lexicon_learning_analytics" is ready.')
  await connection.end()
}

main().catch((err) => {
  console.error('Schema init failed.')
  console.error('code:', err.code)
  console.error('errno:', err.errno)
  console.error('sqlMessage:', err.sqlMessage)
  console.error('sqlState:', err.sqlState)
  console.error('message:', err.message)
  console.error(err)
  process.exit(1)
})
