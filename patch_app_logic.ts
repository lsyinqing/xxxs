import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

// Patch 1: processNext logic
const regexProcessNext = /const processNext = async \(\) => \{[\s\S]*?processNext\(\);\n  \}, \[isSingleRunning, singleTasks, modeSnapshot\]\);/m;

const replacementProcessNext = `const runningCount = singleTasks.filter(t => t.status === 'step1_running').length;
    const CONCURRENCY_LIMIT = 3;

    if (runningCount < CONCURRENCY_LIMIT) {
      const availableSlots = CONCURRENCY_LIMIT - runningCount;
      const pendingTasks = singleTasks.filter(t => t.status === 'pending').slice(0, availableSlots);
      
      if (pendingTasks.length > 0) {
        pendingTasks.forEach(task => {
          runSingleGeneration(task);
        });
      } else if (runningCount === 0) {
        setIsSingleRunning(false);
      }
    }
  }, [isSingleRunning, singleTasks, modeSnapshot]);`;

content = content.replace(regexProcessNext, replacementProcessNext);

// Patch 2: validation logic
const regexValidation = /\/\/ Fallback filename extraction[\s\S]*?if \(modeSnapshot\.autoFlowMode === 'auto'\) \{[\s\S]*?updateTasks\(prev => prev\.map\(t => \{/m;

const replacementValidation = `// Fallback filename extraction
      const filename = extractFilename(subResults[0]?.text || '');
      const maxCharCount = Math.max(0, ...subResults.map(sr => sr.text.replace(/[\\r\\n]/g, '').length || 0));
      
      let isCompleted = modeSnapshot.autoFlowMode === 'auto';
      let needsRetry = false;
      const newLogs = [...currentLogs];

      if (modeSnapshot.autoFlowMode === 'auto') {
        if (maxCharCount < 5500 && attempt < 3) { 
           needsRetry = true;
           isCompleted = false;
           newLogs.push(\`[第 \${attempt} 次尝试] 最佳字数：\${maxCharCount}。低于5500字，准备重试...\`);
        } else if (maxCharCount < 5500 && attempt >= 3) { 
           newLogs.push(\`[第 \${attempt} 次尝试] 最佳字数：\${maxCharCount}。已达重试上限，保留当前结果。\`);
        } else { 
           newLogs.push(\`[第 \${attempt} 次尝试] 最佳字数：\${maxCharCount}。字数达标，任务完成。\`);
        }
      }

      updateTasks(prev => prev.map(t => {`;

content = content.replace(regexValidation, replacementValidation);

fs.writeFileSync('src/App.tsx', content);
