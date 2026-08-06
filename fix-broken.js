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
    
    // We injected:
    // \n  try { params } catch (error) {\n    console.error("[...] error:", error);\n    return NextResponse.json(\n      { error: "??? ??? ?????" },\n      { status: 500 }\n    );\n  }\n
    
    // Replace the broken try block inside parameters back to ' params '
    content = content.replace(/\n\s*try \{ params \} catch \(error\) \{[\s\S]*?\}\n/, ' params ');
    
    // Also position/route.ts has 2 broken ones maybe?
    // Replace all occurrences of that broken try catch
    content = content.replace(/\n\s*try \{ params \} catch \(error\) \{[\s\S]*?\}\n/g, ' params ');
    
    fs.writeFileSync(file, content, 'utf8');
}
