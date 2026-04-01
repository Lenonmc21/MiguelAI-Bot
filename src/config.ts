import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env') });

const getEnvOrThrow = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value; // It will still return the literal "SUTITUYE POR EL TUYO" if not updated, but standard JS env loading applies.
};

export const config = {
  TELEGRAM_BOT_TOKEN: getEnvOrThrow('TELEGRAM_BOT_TOKEN'),
  TELEGRAM_ALLOWED_USER_IDS: getEnvOrThrow('TELEGRAM_ALLOWED_USER_IDS')
    .split(',')
    .map((id) => parseInt(id.trim(), 10))
    .filter((id) => !isNaN(id)),
  GROQ_API_KEY: getEnvOrThrow('GROQ_API_KEY'),
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '',
  OPENROUTER_MODEL: process.env.OPENROUTER_MODEL || 'openrouter/free',
  DB_PATH: process.env.DB_PATH || './memory.db',
  GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS || './service-account.json',
};

// Security check for IDs
if (config.TELEGRAM_ALLOWED_USER_IDS.length === 0) {
    console.warn("WARNING: No valid Telegram user IDs allowed. The bot will ignore everyone.");
}
