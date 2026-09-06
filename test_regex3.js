let text = `【**【指令执行确认】**
1. **部分情绪饱满，剧情丰富，完全契合女频爽文/大女主独美法则，字数与内容量极度充实（满足万字短篇小说后半段的内容厚度要求）。
3. **去AI化与排版**：严格遵守知乎风短篇排版（短句、频繁换行、对白独立），已清洗“仿佛、一抹、嘴角勾起、不仅更是”等高频AI词汇，情绪完全视觉化、动作化。无冗长旁白总结。
4. **反派处理**：未将反派工具人化，深度挖掘裴青砚“用报复掩饰违背伦理的龌龊占有欲”这一初始欲望，并在结局实施了极致的“物理+精神”双重诛心。】

正文开始...`;

let cleaned = text.replace(/^【[\s\S]{0,100}?(?:指令(?:执行)?确认|已?收到指令|已?接收指令)[\s\S]{0,2000}?(?:\n\s*\n|\n(?=[^\n]*正文))/g, function(match) {
    return ""; // Actually, this is getting complicated.
});

// A simpler way: Find the index of the first `】` that comes after the keywords, but since there could be `**`, maybe we just find `】` that is at the end of a line or followed by `\n`.
let cleaned2 = text.replace(/^【[\s\S]{0,200}?(?:指令(?:执行)?确认|已?收到指令|已?接收指令|创作模式|执行知乎风)[\s\S]{0,2000}?】\s*/, '');

console.log("CLEANED2:", JSON.stringify(cleaned2));
