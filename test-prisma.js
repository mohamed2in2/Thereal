const { PrismaClient } = require('./src/generated/prisma');
const prisma = new PrismaClient();
async function main() {
  try {
    const courses = await prisma.course.findMany({
      include: { teacher: { select: { id: true, name: true } }, _count: { select: { accessCodes: true } } },
      orderBy: { createdAt: 'desc' }
    });
    console.log('Success:', courses.length);
  } catch (e) {
    console.error('Prisma Error:', e);
  }
}
main().finally(() => prisma.$disconnect());
