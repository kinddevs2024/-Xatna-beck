const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const unsetNullField = async (field) => {
    const res = await prisma.$runCommandRaw({
      update: 'users',
      updates: [
        {
          q: { [field]: null },
          u: { $unset: { [field]: '' } },
          multi: true,
        },
      ],
    });
    console.log(`[cleanup] unset null ${field}:`, res);
  };

  await unsetNullField('tg_id');
  await unsetNullField('tg_username');
}

main()
  .catch((e) => {
    console.error('[cleanup] failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
