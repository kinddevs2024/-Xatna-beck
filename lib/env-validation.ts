/**
 * Environment validation for this repo (Telegram bot + MongoDB).
 * MONGODB_URI is required where Prisma runs.
 * BOT_TOKEN is required only when actually running the bot (`npm run bot`).
 */

const requiredForPrisma = ['MONGODB_URI'] as const;

export function validateEnv(): void {
  const missing: string[] = [];
  const invalid: string[] = [];

  for (const varName of requiredForPrisma) {
    const value = process.env[varName];
    if (!value || value.trim() === '') {
      missing.push(varName);
    } else if (varName === 'MONGODB_URI') {
      if (
        !value.startsWith('mongodb://') &&
        !value.startsWith('mongodb+srv://')
      ) {
        invalid.push(
          `${varName} must start with 'mongodb://' or 'mongodb+srv://'`
        );
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
        `Set them in .env (see env.example).`
    );
  }

  if (invalid.length > 0) {
    throw new Error(`Invalid environment variables:\n${invalid.join('\n')}`);
  }

  console.log('[Env] MONGODB_URI is configured.');
}

export function assertBotToken(): void {
  if (!process.env.BOT_TOKEN || process.env.BOT_TOKEN.trim() === '') {
    throw new Error('BOT_TOKEN is missing. Add it to .env to run the Telegram bot.');
  }
}
