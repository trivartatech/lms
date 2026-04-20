import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

export const env = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL!,
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'access-secret',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'refresh-secret',
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',

  // SMTP for outbound email (quotation/agreement delivery)
  SMTP_HOST:     process.env.SMTP_HOST     || '',
  SMTP_PORT:     parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_USER:     process.env.SMTP_USER     || '',
  SMTP_PASS:     process.env.SMTP_PASS     || '',
  SMTP_FROM:     process.env.SMTP_FROM     || 'Trivarta Tech <noreply@trivarta.in>',

  // Mag91 WhatsApp
  MAG91_API_KEY:     process.env.MAG91_API_KEY     || '',
  MAG91_SENDER_ID:   process.env.MAG91_SENDER_ID   || '',
  MAG91_BASE_URL:    process.env.MAG91_BASE_URL    || 'https://api.mag91.com',

  // Expo push
  EXPO_ACCESS_TOKEN: process.env.EXPO_ACCESS_TOKEN || '',
}
