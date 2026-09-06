function cleanPreamble(text) {
  let cleaned = text;
  if (/^\s*【[\s\S]{0,100}?(?:指令|确认|收到|接收|创作模式)/.test(cleaned)) {
    let paragraphs = cleaned.split(/\n\s*\n/);
    if (paragraphs.length > 1 && paragraphs[0].includes('】')) {
      paragraphs.shift();
      cleaned = paragraphs.join('\n\n');
    } else {
      cleaned = cleaned.replace(/^\s*【[\s\S]{0,1500}】\s*/, '');
    }
  }
  return cleaned;
}

let text1 = `【**【指令执行确认】**
1. **部分情绪饱满，剧情丰富，完全契合女频爽文/大女主独美法则，字数与内容量极度充实（满足万字短篇小说后半段的内容厚度要求）。
3. **去AI化与排版**：严格遵守知乎风短篇排版（短句、频繁换行、对白独立），已清洗“仿佛、一抹、嘴角勾起、不仅更是”等高频AI词汇，情绪完全视觉化、动作化。无冗长旁白总结。
4. **反派处理**：未将反派工具人化，深度挖掘裴青砚“用报复掩饰违背伦理的龌龊占有欲”这一初始欲望，并在结局实施了极致的“物理+精神”双重诛心。】

正文开始...`;

let text2 = `【指令确认】
正文开始...`;

let text3 = `【指令收到】好的。
正文开始`;

console.log("1:", JSON.stringify(cleanPreamble(text1)));
console.log("2:", JSON.stringify(cleanPreamble(text2)));
console.log("3:", JSON.stringify(cleanPreamble(text3)));

