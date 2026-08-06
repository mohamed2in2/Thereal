const { PrismaClient } = require('../src/generated/prisma');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      email: {
        contains: 'alasly.live',
      },
    },
  });

  console.log(`Found ${users.length} users with alasly.live emails.`);

  let updatedCount = 0;
  for (const user of users) {
    const newEmail = user.email.replace('alasly.live', 'code-up.tech');
    await prisma.user.update({
      where: { id: user.id },
      data: { email: newEmail },
    });
    updatedCount++;
  }

  console.log(`Successfully updated ${updatedCount} users.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
