let text = `1.

没有清理干净`;

let cleaned = text.replace(/^\s*\d+[\.\、\s]+\s*/, '');
console.log("TEST 1:", JSON.stringify(cleaned));
