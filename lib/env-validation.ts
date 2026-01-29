/**
 * Environment variable validation
 * Validates required environment variables on server startup
 */

const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET', 'JWT_EXPIRATION'] as const;

/**
 * Validates environment variables
 * @throws {Error} If required environment variables are missing or invalid
 */
export function validateEnv(): void {
  const missing: string[] = [];
  const invalid: string[] = [];

  // Check required variables
  for (const varName of requiredEnvVars) {
    const value = process.env[varName];
    if (!value || value.trim() === '') {
      missing.push(varName);
    } else {
      // Additional validation
      if (varName === 'JWT_SECRET' && value.length < 32) {
        invalid.push(`${varName} must be at least 32 characters long`);
      }
      if (varName === 'DATABASE_URL' && !value.startsWith('file:') && !value.startsWith('postgresql://')) {
        invalid.push(`${varName} must start with 'file:' (SQLite) or 'postgresql://' (PostgreSQL)`);
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      `Please check your .env file and ensure all required variables are set.`
    );
  }

  if (invalid.length > 0) {
    throw new Error(
      `Invalid environment variables:\n${invalid.join('\n')}\n` +
      `Please fix these issues in your .env file.`
    );
  }

  // Warn about optional but recommended variables
  if (!process.env.FRONTEND_URL) {
    console.warn('[Env Validation] ⚠️ FRONTEND_URL is not set. CORS may not work correctly.');
  }

  console.log('[Env Validation] ✅ All required environment variables are valid');
}
