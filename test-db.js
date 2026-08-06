const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const dataUrl = 'data:image/jpeg;base64,' + 'A'.repeat(50000);
    const course = await prisma.course.create({
      data: {
        title: 'Test Large URL',
        subject: 'Math',
        educationalStage: 'HS',
        teacherId: 'test-teacher',
        thumbnailUrl: dataUrl
      }
    });
    console.log('Success:', course.id);
  } catch(e) {
    console.error('Error:', e);
  }
}
test();
