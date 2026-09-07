import 'dotenv/config'
import { app } from './app.js'
import { testConnection } from './config/db.js'

import { startGithubPolling } from './jobs/githubPolling.js'

const PORT = process.env.PORT || 4000

async function start() {
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
    
    // Sunucu sorunsuz ayağa kalktıktan sonra arka planda GitHub taramasını başlatıyoruz
    startGithubPolling();
  })
}

start()