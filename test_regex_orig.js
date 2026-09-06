let text = `1.
正文内容...`;

let cleaned = text.replace(/^\s*\d+[\.、]\s*/g, '');
console.log("TEST 1:", JSON.stringify(cleaned));

let text2 = `12.  正文内容...`;
let cleaned2 = text2.replace(/^\s*\d+[\.、]\s*/g, '');
console.log("TEST 2:", JSON.stringify(cleaned2));

let text3 = `1.正文内容...`;
let cleaned3 = text3.replace(/^\s*\d+[\.、]\s*/g, '');
console.log("TEST 3:", JSON.stringify(cleaned3));
