import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const oldFuncRegex = /function cleanGeneratedText\(text: string\): string \{[\s\S]*?return cleaned\.trim\(\);\n\}/m;

const newFunc = `function cleanGeneratedText(text: string): string {
  let cleaned = text;
  
  // 1. 尝试匹配 "前情解码...正文" 的成块内容 (跨段落)
  // 将前面的 ### 和括号也包含进去（如果有的话）
  cleaned = cleaned.replace(/(?:###\\s*)?(?:\\[|【|\\()?前情(?:解码|提要|回顾)(?:\\]|】|\\))?[\\s\\S]*?(?:###\\s*)?(?:\\[|【|\\()?(?:大结局)?正文(?:\\]|】|\\))?[：:]?/g, '');

  // 2. 如果没有明确的正文标志，但段落中有前情解码，则移除该整段落
  let paragraphs = cleaned.split(/\\n\\s*\\n/);
  const qIdx = paragraphs.findIndex(p => p.match(/前情(?:解码|提要|回顾)/));
  if (qIdx !== -1 && qIdx <= 1) { // 限制在开头部分
    paragraphs.splice(qIdx, 1);
    cleaned = paragraphs.join('\\n\\n');
  }

  // 3. 兜底删除残留的过渡词
  cleaned = cleaned.replace(/(?:###\\s*)?(?:\\[|【|\\()?(?:大结局)?正文(?:\\]|】|\\))?[：:]?/g, '');
  cleaned = cleaned.replace(/(?:###\\s*)?(?:\\[|【|\\()?前情(?:解码|提要|回顾)(?:\\]|】|\\))?[：:]?/g, '');

  // 4. 第二次清洗：特别注意第二遍输出结果中有没有 ###1. 要记得删除
  cleaned = cleaned.replace(/###\\s*\\d+\\.?/g, '');
  
  // 5. 删除残留的空括号结构，比如 ### [] 或 ### 【】 及其内部可能残留的换行
  cleaned = cleaned.replace(/###\\s*\\[\\s*\\]/g, '');
  cleaned = cleaned.replace(/###\\s*【\\s*】/g, '');
  cleaned = cleaned.replace(/###\\s*\\(\\s*\\)/g, '');
  
  // 清理单独一行的 ### 
  cleaned = cleaned.replace(/^###\\s*$/gm, '');

  // 6. 删除 AI 擅自加的 "第X章"
  cleaned = cleaned.replace(/第[一二三四五六七八九十百千0-9]+章[^\\n]*/g, '');
  
  // 清除开头多余的空行
  cleaned = cleaned.replace(/^\\s+/, '');
  
  return cleaned.trim();
}`;

content = content.replace(oldFuncRegex, newFunc);
fs.writeFileSync('src/App.tsx', content);

