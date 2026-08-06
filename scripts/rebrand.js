const fs = require('fs');
const path = require('path');

const replacements = [
  { from: /الطلاب/g, to: 'المتعلمين' },
  { from: /للطلاب/g, to: 'للمتعلمين' },
  { from: /للطالب/g, to: 'للمتعلم' },
  { from: /الطالب/g, to: 'المتعلم' },
  { from: /بين طلاب/g, to: 'بين متعلمي' },
  { from: /\bطالب\b/g, to: 'متعلم' },
  
  { from: /المدرسين/g, to: 'المعلمين' },
  { from: /للمدرس/g, to: 'للمعلم' },
  { from: /المدرس/g, to: 'المعلم' },
  { from: /\bمدرس\b/g, to: 'معلم' },
  
  { from: /التعليمية/g, to: 'الكورسات' },
  { from: /تعليمية/g, to: 'كورسات' },
  
  { from: /التعليمي/g, to: 'التدريبي' },
  { from: /تعليمي/g, to: 'تدريبي' },
  
  { from: /الدراسية/g, to: 'التدريبية' },
  { from: /دراسية/g, to: 'تدريبية' },
  
  { from: /الدراسي/g, to: 'التدريبي' },
  { from: /دراسي/g, to: 'تدريبي' },

  { from: /الدراسة/g, to: 'التعلم' },
  { from: /دراسة/g, to: 'تعلم' },
  
  { from: /المدرسة/g, to: 'المنصة' },
  { from: /مدرسة/g, to: 'منصة' },
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
