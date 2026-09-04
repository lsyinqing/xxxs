import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

const regexPreview = /\{\/\* Generated Text View[\s\S]*?\{\s*task\.subResults\.length > 0 && \([\s\S]*?<\div>\s*\)\s*\}/m;

content = content.replace(regexPreview, '');
fs.writeFileSync('src/App.tsx', content);
