let text = "### [前情回顾]\n\nbla bla\n\n### [大结局正文]";
let cleaned = text;

cleaned = cleaned.replace(/(?:###\s*)?(?:\[|【|\()?前情(?:解码|提要|回顾)(?:\]|】|\))?[\s\S]*?(?:###\s*)?(?:\[|【|\()?(?:大结局)?正文(?:\]|】|\))?[：:]?/g, '');

console.log("TEST 1:", JSON.stringify(cleaned));

let text2 = "### 2\n### []\n\n承恩公府。";
let cleaned2 = text2.replace(/###\s*\[\s*\]/g, '');
cleaned2 = cleaned2.replace(/^###\s*$/gm, '');
console.log("TEST 2:", JSON.stringify(cleaned2));
