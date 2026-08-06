const fs = require('fs');

const files = [
  "src/app/api/admin/courses/[id]/folders/route.ts",
  "src/app/api/admin/courses/[id]/pricing/route.ts",
  "src/app/api/admin/students/[id]/reset-devices/route.ts",
  "src/app/api/admin/videos/[id]/route.ts",
  "src/app/api/courses/[id]/route.ts",
  "src/app/api/courses/[id]/watch-count/route.ts",
  "src/app/api/quizzes/[id]/route.ts",
  "src/app/api/quizzes/[id]/submit/route.ts",
  "src/app/api/videos/[id]/complete/route.ts",
  "src/app/api/videos/[id]/position/route.ts",
  "src/app/api/videos/[id]/watch/route.ts"
];

for (const file of files) {
    if (!fs.existsSync(file)) continue;
    let content = fs.readFileSync(file, 'utf8');
    
    content = content.replace(/\{ params[\s\S]*?\}: \{ params/g, '{ params }: { params');
    
    fs.writeFileSync(file, content, 'utf8');
}
