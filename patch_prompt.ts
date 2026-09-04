import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf8');

const regex = /let finalPrompt = '';[\s\S]*?const OPENAI_API_KEY/m;

const replacement = `let finalPrompt = '';
          if (systemPrompt) finalPrompt += \`\${systemPrompt}\\n\\n\`;
          if (extraPrompt) finalPrompt += \`【必须绝对服从的强制指令】：\\n\${extraPrompt}\\n\\n\`;
          if (kbPrompt) finalPrompt += \`【参考附加知识库】：\\n\${kbPrompt}\\n\\n\`;
          
          if (finalPrompt.includes('{input}')) {
            finalPrompt = finalPrompt.replace(/\\{input\\}/g, input);
          } else {
            finalPrompt += \`【待处理素材/输入内容】：\\n\${input}\`;
          }

          const OPENAI_API_KEY`;

content = content.replace(regex, replacement);
fs.writeFileSync('server.ts', content);

