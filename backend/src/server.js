import 'dotenv/config'
import { app } from './app.js'
import { testConnection } from './config/db.js'

import { startGithubPolling } from './jobs/githubPolling.js'

const PORT = process.env.PORT || 4000

async function start() {
  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is not set. Set it in your environment before starting the server.')
    process.exit(1)
  }

  try {
    await testConnection()
    console.log('MySQL connection OK')
  } catch (err) {
    console.error('Could not connect to MySQL. Check your .env values.')
    console.error(err.message)
    process.exit(1)
  }

  app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`)
    
    startGithubPolling();
  })
}

start()