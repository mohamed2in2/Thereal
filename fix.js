const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  try {
      const list = fs.readdirSync(dir);
      list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
          results = results.concat(walk(file));
        } else {
          if (file.endsWith('route.ts')) {
            results.push(file);
          }
        }
      });
  } catch (err) {}
  return results;
}

const files = walk('src/app/api');
let wrapped = [];

const searchTerms = [
  'export async function GET',
  'export async function POST',
  'export async function PUT',
  'export async function DELETE',
  'export async function PATCH'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('try {') || content.includes('try{')) return;

  let modified = false;

  let matches = [];
  for (const term of searchTerms) {
    let idx = content.indexOf(term);
    while (idx !== -1) {
      matches.push({ start: idx, method: term });
      idx = content.indexOf(term, idx + term.length);
    }
  }

  matches.sort((a, b) => b.start - a.start);

  for (const match of matches) {
    const openBraceIdx = content.indexOf('{', match.start);
    if (openBraceIdx === -1) continue;

    const bodyStart = openBraceIdx + 1;
    let openBraces = 1;
    let bodyEnd = -1;

    for (let i = bodyStart; i < content.length; i++) {
      if (content[i] === '{') openBraces++;
      if (content[i] === '}') {
        openBraces--;
        if (openBraces === 0) {
          bodyEnd = i;
          break;
        }
      }
    }

    if (bodyEnd !== -1) {
      const funcBody = content.substring(bodyStart, bodyEnd);
      
      const routePath = file.replace(/\\/g, '/');
      let routeName = routePath;
      if (routePath.includes('src/app/api/')) {
          routeName = routePath.split('src/app/api/')[1].replace('/route.ts', '');
      }

      const newBody = `\n  try {` + funcBody + `} catch (error) {\n    console.error("[` + routeName + `] error:", error);\n    return NextResponse.json(\n      { error: "حدث خطأ داخلي" },\n      { status: 500 }\n    );\n  }\n`;
      
      content = content.substring(0, bodyStart) + newBody + content.substring(bodyEnd);
      modified = true;
    }
  }

  if (modified) {
    if (!content.includes('NextResponse')) {
        content = `import { NextResponse } from "next/server";\n` + content;
    }
    fs.writeFileSync(file, content, 'utf8');
    wrapped.push(file);
  }
});

console.log(wrapped.map(f => f.replace(/\\/g, '/')).join('\\n'));
