let text = `【**【指令执行确认】**
1. **部分情绪饱满，剧情丰富，完全契合女频爽文/大女主独美法则，字数与内容量极度充实（满足万字短篇小说后半段的内容厚度要求）。
3. **去AI化与排版**：严格遵守知乎风短篇排版（短句、频繁换行、对白独立），已清洗“仿佛、一抹、嘴角勾起、不仅更是”等高频AI词汇，情绪完全视觉化、动作化。无冗长旁白总结。
4. **反派处理**：未将反派工具人化，深度挖掘裴青砚“用报复掩饰违背伦理的龌龊占有欲”这一初始欲望，并在结局实施了极致的“物理+精神”双重诛心。】

正文开始...`;

let cleaned = text;
if (/^【[\s\S]{0,50}(?:指令|确认|接收)/.test(cleaned)) {
    // It's a preamble. We can find the first \n\n and remove everything before it.
    let parts = cleaned.split(/\n\s*\n/);
    if (parts.length > 1) {
        parts.shift(); // remove the first block
        cleaned = parts.join('\n\n');
    }
}
console.log("CLEANED:", JSON.stringify(cleaned));

// What if the preamble is not separated by \n\n?
// For example:
// 【指令确认】
// 正文开始...
let text2 = `【指令确认】
正文开始...`;
let cleaned2 = text2;
if (/^【[\s\S]{0,50}(?:指令|确认|接收|创作模式)/.test(cleaned2)) {
    cleaned2 = cleaned2.replace(/^【[\s\S]{0,2000}?】\s*/, ''); 
    // This will work if there is no nesting of 】 before the end of the block.
    // Wait, in test 1, the inner 】 stopped the match.
}
console.log("CLEANED2:", JSON.stringify(cleaned2));
