import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const regexOrig = /function cleanOriginalText\(text: string\): string \{[\s\S]*?return cleaned\.trim\(\);\n\}/m;
const newOrig = `function cleanOriginalText(text: string): string {
  let cleaned = text;

  // 清除开头残留的序号 (如 "1." 或 "1、" 或 "1 " 以及可能跟在后面的空白/换行)
  cleaned = cleaned.replace(/^\\s*\\d+[\\.\\、\\s]+\\s*/, '');

  // Remove "第X章", "[修改后最终结果]", titles, and any other chapter headings
  cleaned = cleaned.replace(/第[一二三四五六七八九十百千0-9零〇]+[章节回集部篇].*/g, '');
  cleaned = cleaned.replace(/\\[修改后最终结果\\]/g, '');
  return cleaned.trim();
}`;

content = content.replace(regexOrig, newOrig);


const regexGen = /function cleanGeneratedText\(text: string\): string \{[\s\S]*?\/\/ 0\. 清理AI回复开头的系统确认废话[\s\S]*?cleaned = cleaned\.replace\(\/\^【【\?\(?:系统指令确认\|已\?收到指令\|已\?接收指令\|指令已\?确认\)】\?\[\\\\s\\\\S\]\*?\?】\\\\s\*\/\, ''\);/m;

const newGen = `function cleanGeneratedText(text: string): string {
  let cleaned = text;

  // 0. 清理AI回复开头的系统确认废话，例如：【【系统指令确认】...】(支持多段落)
  if (/^\\s*【[\\s\\S]{0,100}?(?:指令|确认|收到|接收|创作模式)/.test(cleaned)) {
    let paragraphs = cleaned.split(/\\n\\s*\\n/);
    if (paragraphs.length > 1 && paragraphs[0].includes('】')) {
      paragraphs.shift();
      cleaned = paragraphs.join('\\n\\n');
    } else {
      cleaned = cleaned.replace(/^\\s*【[\\s\\S]{0,1500}】\\s*/, '');
    }
  }`;

content = content.replace(regexGen, newGen);

fs.writeFileSync('src/App.tsx', content);

