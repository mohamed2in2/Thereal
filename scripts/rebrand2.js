const fs = require('fs');
const path = require('path');

const replacements = [
  { from: /من الصف السادس حتى الثالث الثانوي/g, to: 'لمختلف الأعمار والمستويات' },
  { from: /من الصف السادس الابتدائي حتى الثالث الثانوي/g, to: 'لمختلف الأعمار والمستويات' },
  { from: /الرياضيات، الفيزياء، الكيمياء، والأحياء/g, to: 'مجالات متنوعة مثل التكنولوجيا والعلوم' },
  { from: /الصف السادس الابتدائي/g, to: 'المستوى الأول (تأسيسي)' },
  { from: /الصف الأول الإعدادي/g, to: 'المستوى الثاني' },
  { from: /الصف الثاني الإعدادي/g, to: 'المستوى الثالث' },
  { from: /الصف الثالث الإعدادي/g, to: 'المستوى الرابع' },
  { from: /الصف الأول الثانوي/g, to: 'المستوى الخامس' },
  { from: /الصف الثاني الثانوي/g, to: 'المستوى السادس' },
  { from: /الصف الثالث الثانوي/g, to: 'المستوى المتقدم' },
];

function processDirectory(directory) {
  const files = fs.readdirSync(directory);

  for (const file of files) {
    const fullPath = path.join(directory, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let originalContent = content;

      for (const { from, to } of replacements) {
        content = content.replace(from, to);
      }

      if (content !== originalContent) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated: ${fullPath}`);
      }
    }
  }
}

const targetDir = path.join(__dirname, '../src');
console.log(`Processing directory: ${targetDir}`);
processDirectory(targetDir);
console.log('Rebranding complete.');
