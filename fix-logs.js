const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        results.push(file);
      }
    }
  });
  return results;
}

const targetDirs = [
  path.join(__dirname, 'src/app/api/admin/superadmin/plans'),
  path.join(__dirname, 'src/app/api/admin/superadmin/plan-progress'),
  path.join(__dirname, 'src/app/api/admin/plan-submissions')
];

let files = [];
targetDirs.forEach(dir => {
  if (fs.existsSync(dir)) files = files.concat(walk(dir));
});

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('details:')) {
    const updated = content.replace(/details:\s*(.+),/g, 'targetType: "Plan", targetId: "sys", targetName: "action", metadata: { details: $1 },');
    fs.writeFileSync(file, updated);
    console.log(`Updated ${file}`);
  }
});
