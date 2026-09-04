#!/bin/bash
cat << 'INNER_EOF' > server_poll.ts
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

dotenv.config();

const jobs = new Map<string, any>();

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json({ limit: '50mb' }));

  app.post('/api/generate/start', async (req, res) => {
    try {
      const { systemPrompt, extraPrompt, kbPrompt, input, candidateCount } = req.body;
      const jobId = Date.now().toString() + Math.random().toString(36).substring(7);
      
      jobs.set(jobId, { status: 'running' });
      res.json({ jobId });

      // Start background job
      (async () => {
        try {
          let finalPrompt = '';
          if (systemPrompt) finalPrompt += \`\${systemPrompt}\n\n\`;
          if (extraPrompt) finalPrompt += \`【必须绝对服从的强制指令】：\n\${extraPrompt}\n\n\`;
          if (kbPrompt) finalPrompt += \`【参考附加知识库】：\n\${kbPrompt}\n\n\`;
          
          if (finalPrompt.includes('{input}')) {
            finalPrompt = finalPrompt.replace(/\{input\}/g, input);
          } else {
            finalPrompt += \`【待处理素材/输入内容】：\n\${input}\`;
          }

          const OPENAI_API_KEY = "sk-TSlcnHln2IlPF65jFqcvKQWtcMCMAfgcgfuJV1cytVKXFtAY";
          const BASE_URL = "https://api.openlux.ai/v1/chat/completions";
          const MODEL = "gemini-3-pro-preview";

          const numCandidates = candidateCount ? parseInt(candidateCount, 10) : 1;
          
          const generatePromises = Array.from({ length: numCandidates }).map(async () => {
            const response = await fetch(BASE_URL, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': \`Bearer \${OPENAI_API_KEY}\`
              },
              body: JSON.stringify({
                model: MODEL,
                messages: [{ role: "user", content: finalPrompt }],
                temperature: 0.7 + (Math.random() * 0.2),
                safetySettings: [
                  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
                  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" }
                ]
              })
            });

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(\`API Error (\${response.status}): \${errorText}\`);
            }

            const data = await response.json();
            return data.choices?.[0]?.message?.content || "";
          });

          const texts = await Promise.all(generatePromises);
          jobs.set(jobId, { status: 'completed', results: texts });
        } catch (error: any) {
          console.error('Job generation error:', error);
          jobs.set(jobId, { status: 'error', error: error.message || 'An error occurred during generation' });
        }
      })();

    } catch (error: any) {
      console.error('Start generation error:', error);
      res.status(500).json({ error: error.message || 'Failed to start job' });
    }
  });

  app.get('/api/generate/status/:jobId', (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json(job);
    
    // Clean up if finished
    if (job.status === 'completed' || job.status === 'error') {
      setTimeout(() => jobs.delete(req.params.jobId), 1000 * 60 * 5); // Delete after 5 mins
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production' || process.env.VITE_DEV_SERVER === 'true') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(\`Server running on http://localhost:\${PORT}\`);
  });
}

startServer();
INNER_EOF

mv server_poll.ts server.ts

cat << 'INNER_EOF' > app_poll.ts
import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /const response = await fetch\('\/api\/generate', \{[\s\S]*?if \(data\.error\) \{\n        throw new Error\(data\.error\);\n      \}/m;

const replacement = `const startResponse = await fetch('/api/generate/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt: modeSnapshot.systemPrompt,
          extraPrompt: modeSnapshot.extraPrompt,
          kbPrompt: modeSnapshot.kbPrompt,
          input: task.originalText,
          candidateCount: modeSnapshot.candidateCount
        })
      });

      if (!startResponse.ok) {
        const errData = await startResponse.json().catch(()=>({error: startResponse.statusText}));
        throw new Error(\`API Error: \${startResponse.status} \${errData.error || ""}\`);
      }
      
      const { jobId } = await startResponse.json();
      
      let data: any = null;
      while (true) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const statusResponse = await fetch(\`/api/generate/status/\${jobId}\`);
        if (!statusResponse.ok) {
          throw new Error(\`Status API Error: \${statusResponse.status}\`);
        }
        
        const statusData = await statusResponse.json();
        
        if (statusData.status === 'completed') {
          data = statusData;
          break;
        } else if (statusData.status === 'error') {
          throw new Error(statusData.error);
        }
      }`;

content = content.replace(regex, replacement);
fs.writeFileSync('src/App.tsx', content);

INNER_EOF

npx tsx app_poll.ts
