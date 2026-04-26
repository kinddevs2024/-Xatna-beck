/**
 * Environment validation for this repo (Telegram bot + MongoDB).
 * DATABASE_URL is always required where Prisma runs.
 * BOT_TOKEN is required only when actually running the bot (`npm run bot`).
 */

const requiredForPrisma = ['DATABASE_URL'] as const;

export function validateEnv(): void {
  const missing: string[] = [];
  const invalid: string[] = [];

  for (const varName of requiredForPrisma) {
    const value = process.env[varName];
    if (!value || value.trim() === '') {
      missing.push(varName);
    } else if (varName === 'DATABASE_URL') {
      if (
        !value.startsWith('file:') &&
        !value.startsWith('postgresql://') &&
        !value.startsWith('postgres://') &&
        !value.startsWith('mongodb://') &&
        !value.startsWith('mongodb+srv://')
      ) {
        invalid.push(
          `${varName} must start with 'file:', 'postgresql://', or 'mongodb://'/'mongodb+srv://'`
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

  console.log('[Env] DATABASE_URL is configured.');
}

export function assertBotToken(): void {
  if (!process.env.BOT_TOKEN || process.env.BOT_TOKEN.trim() === '') {
    throw new Error('BOT_TOKEN is missing. Add it to .env to run the Telegram bot.');
  }
}
