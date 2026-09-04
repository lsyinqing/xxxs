let text = `【【系统指令确认】
已接收指令，启动女频超短篇小说高阶创作模式。严格执行知乎风排版、去AI化禁令及5000字以上字数底线要求。】

### 1
正文内容...`;

let cleaned = text.replace(/^【【?(?:系统指令确认|收到指令|接收指令)】?[\s\S]*?】\s*/, '');
console.log("TEST 1:", JSON.stringify(cleaned));
