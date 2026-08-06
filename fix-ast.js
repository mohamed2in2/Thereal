const { Project, SyntaxKind } = require('ts-morph');
const fs = require('fs');

const filesToProcess = [
  "src/app/api/admin/analytics/route.ts",
  "src/app/api/admin/analytics/weakness/route.ts",
  "src/app/api/admin/codes/route.ts",
  "src/app/api/admin/courses/[id]/folders/route.ts",
  "src/app/api/admin/courses/[id]/pricing/route.ts",
  "src/app/api/admin/profile/slug-check/route.ts",
  "src/app/api/admin/quiz-results/route.ts",
  "src/app/api/admin/students/[id]/reset-devices/route.ts",
  "src/app/api/admin/superadmin/errors/route.ts",
  "src/app/api/admin/superadmin/settings/grace-days/route.ts",
  "src/app/api/admin/superadmin/settings/max-devices/route.ts",
  "src/app/api/admin/videos/[id]/route.ts",
  "src/app/api/ai/status/route.ts",
  "src/app/api/auth/logout/route.ts",
  "src/app/api/codes/route.ts",
  "src/app/api/courses/[id]/route.ts",
  "src/app/api/courses/[id]/watch-count/route.ts",
  "src/app/api/progress/route.ts",
  "src/app/api/quizzes/[id]/route.ts",
  "src/app/api/quizzes/[id]/submit/route.ts",
  "src/app/api/student/stats/route.ts",
  "src/app/api/videos/[id]/complete/route.ts",
  "src/app/api/videos/[id]/position/route.ts",
  "src/app/api/videos/[id]/watch/route.ts"
];

const project = new Project();
for (const f of filesToProcess) {
    if (fs.existsSync(f)) {
        project.addSourceFileAtPath(f);
    }
}

let wrappedFiles = [];
const sourceFiles = project.getSourceFiles();

for (const file of sourceFiles) {
    let modified = false;
    const functions = file.getFunctions();
    
    for (const func of functions) {
        if (!func.isExported() || !func.isAsync()) continue;
        const name = func.getName();
        if (!['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(name)) continue;

        const body = func.getBody();
        if (!body || body.getKind() !== SyntaxKind.Block) continue;
        
        const fullBodyText = body.getText();
        if (fullBodyText.includes('try {') || fullBodyText.includes('try{')) continue;
        
        const innerText = fullBodyText.substring(1, fullBodyText.length - 1);
        
        const routePath = file.getFilePath().replace(/\\/g, '/');
        let routeName = routePath;
        if (routePath.includes('src/app/api/')) {
            routeName = routePath.split('src/app/api/')[1].replace('/route.ts', '');
        }
        
        const newBody = `\n  try {` + innerText + `} catch (error) {\n    console.error("[` + routeName + `] error:", error);\n    return NextResponse.json(\n      { error: "حدث خطأ داخلي" },\n      { status: 500 }\n    );\n  }\n`;
        
        func.setBodyText(newBody);
        modified = true;
    }
    
    if (modified) {
        const hasNextResponse = file.getImportDeclarations().some(imp => 
            imp.getNamedImports().some(n => n.getName() === 'NextResponse')
        );
        
        if (!hasNextResponse) {
            const nextServerImport = file.getImportDeclaration(imp => imp.getModuleSpecifierValue() === 'next/server');
            if (nextServerImport) {
                nextServerImport.addNamedImport('NextResponse');
            } else {
                file.addImportDeclaration({
                    namedImports: ['NextResponse'],
                    moduleSpecifier: 'next/server'
                });
            }
        }
        
        file.saveSync();
        wrappedFiles.push(file.getFilePath());
    }
}

console.log(wrappedFiles.map(f => f.replace(/\\/g, '/')).join('\\n'));
