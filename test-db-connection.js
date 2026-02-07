const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function main() {
  console.log('Testing database connection...');
  console.log('Checking environment variables...');
  // Note: Prisma Client automatically attempts to load .env, but usually from cwd
  console.log('DATABASE_URL is set:', !!process.env.DATABASE_URL); 

  try {
    console.log('Attempting $connect...');
    await prisma.$connect();
    console.log('✅ Connected successfully!');
    
    // Try a simple operation
    const count = await prisma.user.count();
    console.log(`✅ Connection verified. User count: ${count}`);
    
  } catch (e) {
    console.error('❌ Connection failed:');
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
