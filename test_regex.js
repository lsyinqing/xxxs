let text = `【**【指令执行确认】**
1. **部分情绪饱满，剧情丰富，完全契合女频爽文/大女主独美法则，字数与内容量极度充实（满足万字短篇小说后半段的内容厚度要求）。
3. **去AI化与排版**：严格遵守知乎风短篇排版（短句、频繁换行、对白独立），已清洗“仿佛、一抹、嘴角勾起、不仅更是”等高频AI词汇，情绪完全视觉化、动作化。无冗长旁白总结。
4. **反派处理**：未将反派工具人化，深度挖掘裴青砚“用报复掩饰违背伦理的龌龊占有欲”这一初始欲望，并在结局实施了极致的“物理+精神”双重诛心。】

正文开始...`;

// Old regex
console.log("OLD:");
console.log(text.replace(/^【【?(?:系统指令确认|已?收到指令|已?接收指令|指令已?确认)】?[\s\S]*?】\s*/, ''));

// New regex idea
console.log("\nNEW:");
console.log(text.replace(/^【[\s\S]*?(?:指令执行确认|系统指令确认|已?收到指令|已?接收指令|指令已?确认)[\s\S]*?】\s*(?:\n|$)/, ''));

// What if the first `】` is inside, and the last `】` is at the end? 
// If we use greedy `[\s\S]*】` it might eat the whole text if there's a `】` at the end of the text.
// Since the preamble is usually the first paragraph(s), we can just remove EVERYTHING from the start up to the first `】` that is followed by a newline, OR we just match `^【.*?(?:指令).*?】` but wait, the inner `】` stops the non-greedy match.

