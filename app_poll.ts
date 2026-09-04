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

