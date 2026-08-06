const fs = require('fs');

const files = [
  'src/app/api/grade-requests/route.ts',
  'src/app/api/quizzes/[id]/route.ts',
  'src/app/api/quizzes/[id]/submit/route.ts',
  'src/app/api/student/results/route.ts',
  'src/app/api/student/wrong-questions/route.ts'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');

  // quiz.folder.courseId -> quiz.folder?.courseId ?? 'plan'
  content = content.replace(/(\w+)\.quiz\.folder\.courseId/g, "$1.quiz.folder?.courseId ?? 'plan'");
  
  // quiz.folder.course.title -> quiz.folder?.course?.title ?? 'خطة دراسية'
  content = content.replace(/(\w+)\.quiz\.folder\.course\.title/g, "$1.quiz.folder?.course?.title ?? 'خطة دراسية'");
  
  // quiz.folder.name -> quiz.folder?.name ?? 'اختبار خطة'
  content = content.replace(/(\w+)\.quiz\.folder\.name/g, "$1.quiz.folder?.name ?? 'اختبار خطة'");

  // Also bare `quiz.folder.`
  content = content.replace(/(?<!\w)quiz\.folder\.courseId/g, "quiz.folder?.courseId ?? 'plan'");
  content = content.replace(/(?<!\w)quiz\.folder\.course\.title/g, "quiz.folder?.course?.title ?? 'خطة دراسية'");
  content = content.replace(/(?<!\w)quiz\.folder\.name/g, "quiz.folder?.name ?? 'اختبار خطة'");

  // quiz.folder.course.teacherId -> quiz.folder?.course?.teacherId
  content = content.replace(/quiz\.folder\.course\.teacherId/g, "quiz.folder?.course?.teacherId");

  fs.writeFileSync(file, content);
  console.log(`Updated ${file}`);
});
