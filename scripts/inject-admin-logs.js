const fs = require('fs');
const path = require('path');

const walkSync = function(dir, filelist) {
  const files = fs.readdirSync(dir);
  filelist = filelist || [];
  files.forEach(function(file) {
    if (fs.statSync(path.join(dir, file)).isDirectory()) {
      filelist = walkSync(path.join(dir, file), filelist);
    }
    else {
      filelist.push(path.join(dir, file));
    }
  });
  return filelist;
};

const files = walkSync('src/app/api/admin');
const importSnippet1 = `import { logAdminAction } from "@/lib/admin-auth";\n`;
const importSnippet2 = `import { getSession } from "@/lib/auth";\n`;

let modifiedCount = 0;

for (const file of files) {
  if (!file.endsWith('route.ts')) continue;
  
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;
  
  const regex = /export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)\s*\(\s*req[^)]*\)\s*{/g;
  let match;
  let matches = [];
  while ((match = regex.exec(content)) !== null) {
      matches.push({
          method: match[1],
          index: match.index,
          end: regex.lastIndex
      });
  }
  
  if (matches.length > 0) {
      // Add imports if they don't exist
      if (!content.includes('logAdminAction')) {
          content = importSnippet1 + content;
      }
      
      // Calculate offset if imports were added
      let offset = content.length - originalContent.length;
      
      for (const m of matches) {
          const insertPos = m.end + offset;
          
          // Check if session is already retrieved
          const sessionRegex = /const\s+(session|_session|userSession)\s*=\s*await\s+getSession[^\n]*\n/g;
          sessionRegex.lastIndex = insertPos;
          const sessionMatch = sessionRegex.exec(content);
          
          let snippet = '';
          let finalInsertPos = insertPos;
          
          if (sessionMatch && (sessionMatch.index - insertPos < 200)) {
              // We found an existing session definition
              const varName = sessionMatch[1];
              snippet = `
    if (${varName} && ${varName}.role === "superadmin") {
      try {
        await logAdminAction({
          adminId: ${varName}.id,
          adminName: ${varName}.name,
          action: "SUPERADMIN_ACTION",
          targetType: "API_ROUTE",
          targetId: req.nextUrl ? req.nextUrl.pathname : req.url,
          targetName: req.method,
        });
      } catch (e) {}
    }
`;
              finalInsertPos = sessionMatch.index + sessionMatch[0].length;
          } else {
              // Define a custom session object just for this log
              // Note: We avoid re-declaring 'session' if it's declared later, so we use __logSession
              
              if (!content.includes('getSession')) {
                 content = importSnippet2 + content;
                 offset += importSnippet2.length;
                 finalInsertPos += importSnippet2.length;
              }
              
              snippet = `
    const __logSession = await getSession();
    if (__logSession && __logSession.role === "superadmin") {
      try {
        await logAdminAction({
          adminId: __logSession.id,
          adminName: __logSession.name,
          action: "SUPERADMIN_ACTION",
          targetType: "API_ROUTE",
          targetId: req.nextUrl ? req.nextUrl.pathname : req.url,
          targetName: req.method,
        });
      } catch (e) {}
    }
`;
          }
          
          content = content.slice(0, finalInsertPos) + snippet + content.slice(finalInsertPos);
          offset += snippet.length;
      }
  }
  
  if (content !== originalContent) {
      fs.writeFileSync(file, content);
      modifiedCount++;
      console.log("Modified", file);
  }
}

console.log("Total modified:", modifiedCount);
