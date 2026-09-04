#!/bin/bash
cat << 'INNER_EOF' > patch2.ts
import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf8');

const regex = /const generatePromises = Array\.from\(\{ length: numCandidates \}\)\.map\(async \(\) => \{[\s\S]*?res\.status\(500\)\.json\(\{ error: error\.message \|\| 'An error occurred during generation' \}\);\n    \}/m;

const replacement = `
      // Setup Keep-Alive headers
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Transfer-Encoding', 'chunked');
      res.write('{');

      // Send a space character every 15 seconds to prevent gateway timeout
      const keepAliveInterval = setInterval(() => {
        res.write(' ');
      }, 15000);

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
        const text = data.choices?.[0]?.message?.content || "";
        return text;
      });

      const texts = await Promise.all(generatePromises);
      
      clearInterval(keepAliveInterval);
      res.write(\`"results": \${JSON.stringify(texts)}}\`);
      res.end();

    } catch (error: any) {
      console.error('Generation Error:', error);
      // We already wrote '{' to the stream, so we must complete the JSON object
      // If we haven't written keep-alive spaces yet, it will just be '{"error": ...}'
      res.write(\`"error": \${JSON.stringify(error.message || 'An error occurred during generation')}}\`);
      res.end();
    }
`;

content = content.replace(regex, replacement);
fs.writeFileSync('server.ts', content);

INNER_EOF
npx tsx patch2.ts
