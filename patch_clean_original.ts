import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const regexFunc = /function cleanOriginalText\(text: string\): string \{[\s\S]*?return cleaned\.trim\(\);\n\}/m;

const newFunc = `function cleanOriginalText(text: string): string {
  let cleaned = text;

  // 清除开头残留的序号 (如 "1." 或 "1、" 或 "1 " 以及可能跟在后面的空白/换行)
  cleaned = cleaned.replace(/^\\s*\\d+[\\.\\、\\s]+\\s*/, '');

  // Remove "第X章", "[修改后最终结果]", titles
  cleaned = cleaned.replace(/第[一二三四五六七八九十百千0-9]+章.*/g, '');
  cleaned = cleaned.replace(/\\[修改后最终结果\\]/g, '');
  return cleaned.trim();
}`;

content = content.replace(regexFunc, newFunc);
fs.writeFileSync('src/App.tsx', content);

