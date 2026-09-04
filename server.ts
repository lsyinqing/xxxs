import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.post('/api/generate', async (req, res) => {
    try {
      const { systemPrompt, extraPrompt, kbPrompt, input, candidateCount, autoFlowMode } = req.body;
      
      // Construct Prompt
      let finalPrompt = '';
      if (systemPrompt) finalPrompt += `${systemPrompt}\n\n`;
      if (extraPrompt) finalPrompt += `【必须绝对服从的强制指令】：\n${extraPrompt}\n\n`;
      if (kbPrompt) finalPrompt += `【参考附加知识库】：\n${kbPrompt}\n\n`;
      
      // Smart placeholder replacement
      if (finalPrompt.includes('{input}')) {
        finalPrompt = finalPrompt.replace(/\{input\}/g, input);
      } else {
        finalPrompt += `【待处理素材/输入内容】：\n${input}`;
      }

      // Configuration for OpenAI Compatible API
      const OPENAI_API_KEY = "sk-TSlcnHln2IlPF65jFqcvKQWtcMCMAfgcgfuJV1cytVKXFtAY";
      const BASE_URL = "https://api.openlux.ai/v1/chat/completions";
      const MODEL = "gemini-3-pro-preview";

      // Concurrent generation
      const numCandidates = candidateCount ? parseInt(candidateCount, 10) : 1;
      
      const generatePromises = Array.from({ length: numCandidates }).map(async () => {
        let attempts = 0;
        const maxAttempts = 5; // Prevent absolute infinite loops, but allow up to 5 retries
        let lastResult = "";
        
        while (attempts < maxAttempts) {
          attempts++;
          
          const response = await fetch(BASE_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
              model: MODEL,
              messages: [{ role: "user", content: finalPrompt }],
              temperature: 0.7 + (Math.random() * 0.2),
              // Pass standard proxy safety settings mapping just in case the proxy supports them
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
            throw new Error(`API Error (${response.status}): ${errorText}`);
          }

          const data = await response.json();
          const text = data.choices?.[0]?.message?.content || "";
          lastResult = text;

          // If in auto mode, check length (excluding line breaks)
          if (autoFlowMode === 'auto') {
            const charCount = text.replace(/[\r\n]/g, '').length;
            if (charCount >= 6000) {
              return text;
            } else {
              console.log(`[Auto Mode] Attempt ${attempts}: Generated length ${charCount} is less than 6000. Retrying...`);
              // Continue the while loop to retry
            }
          } else {
            // Manual mode, just return the first result
            return text;
          }
        }
        
        console.log(`[Auto Mode] Max attempts reached, returning best effort length: ${lastResult.replace(/[\r\n]/g, '').length}`);
        return lastResult;
      });

      const texts = await Promise.all(generatePromises);

      res.json({ results: texts });
    } catch (error: any) {
      console.error('Generation Error:', error);
      res.status(500).json({ error: error.message || 'An error occurred during generation' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
