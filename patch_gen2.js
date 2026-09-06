import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const targetStr = `function cleanGeneratedText(text: string): string {
  let cleaned = text;

  // 0. 清理AI回复开头的系统确认废话，例如：【【系统指令确认】...】
  cleaned = cleaned.replace(/^【【?(?:系统指令确认|已?收到指令|已?接收指令|指令已?确认)】?[\\s\\S]*?】\\s*/, '');`;

const newStr = `function cleanGeneratedText(text: string): string {
  let cleaned = text;

  // 0. 清理AI回复开头的系统确认废话，例如：【【系统指令确认】...】(支持嵌套与多段落)
  if (/^\\s*【[\\s\\S]{0,100}?(?:指令|确认|收到|接收|创作模式)/.test(cleaned)) {
    let paragraphs = cleaned.split(/\\n\\s*\\n/);
    if (paragraphs.length > 1 && paragraphs[0].includes('】')) {
      paragraphs.shift();
      cleaned = paragraphs.join('\\n\\n');
    } else {
      cleaned = cleaned.replace(/^\\s*【[\\s\\S]{0,1500}】\\s*/, '');
    }
  }`;

content = content.replace(targetStr, newStr);
fs.writeFileSync('src/App.tsx', content);

