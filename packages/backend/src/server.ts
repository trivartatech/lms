import './config/env'
import app from './app'
import { env } from './config/env'
import { startTaskReminderJob } from './jobs/taskReminders'

const server = app.listen(env.PORT, () => {
  console.log(`Server running on http://localhost:${env.PORT}`)
})

// Background jobs
const stopReminders = startTaskReminderJob()

function shutdown(signal: string) {
  console.log(`\n${signal} received — shutting down...`)
  stopReminders()
  server.close(() => process.exit(0))
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT',  () => shutdown('SIGINT'))
