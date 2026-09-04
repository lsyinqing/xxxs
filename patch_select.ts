import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /const subResults: SubResult\[\] = data\.results\.map\(\(text: string, idx: number\) => \(\{\n        id: generateId\(\),\n        text,\n        isSelected: idx === 0 \/\/ Default select first\n      \}\)\);/m;

const replacement = `const textLengths = data.results.map((text: string) => text.replace(/[\\r\\n]/g, '').length || 0);
      const maxIdx = textLengths.indexOf(Math.max(0, ...textLengths));
      
      const subResults: SubResult[] = data.results.map((text: string, idx: number) => ({
        id: generateId(),
        text,
        isSelected: idx === maxIdx // 自动选中字数最多（达标）的那一个方案
      }));`;

content = content.replace(regex, replacement);
fs.writeFileSync('src/App.tsx', content);

