import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /const runSingleGeneration = async \(task: SingleTask\) => \{([\s\S]*?)\} catch \(error\) \{/m;

const replacement = `const runSingleGeneration = async (task: SingleTask, attempt = 1, currentLogs: string[] = []) => {
    updateTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'step1_running' } : t));

    try {
      const response = await fetch('/api/generate', {
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

      if (!response.ok) {
        const errData = await response.json().catch(()=>({error: response.statusText}));
        throw new Error(\`API Error: \${response.status} \${errData.error || ""}\`);
      }
      
      const data = await response.json();
      
      const subResults: SubResult[] = data.results.map((text: string, idx: number) => ({
        id: generateId(),
        text,
        isSelected: idx === 0 // Default select first
      }));

      // Fallback filename extraction
      const filename = extractFilename(subResults[0]?.text || '');
      const charCount = subResults[0]?.text.replace(/[\\r\\n]/g, '').length || 0;
      
      let isCompleted = modeSnapshot.autoFlowMode === 'auto';
      let needsRetry = false;
      const newLogs = [...currentLogs];

      if (modeSnapshot.autoFlowMode === 'auto') {
        if (charCount < 6000 && attempt < 3) {
           needsRetry = true;
           isCompleted = false;
           newLogs.push(\`[第 \${attempt} 次尝试] 返回字数：\${charCount}。低于6000字，准备重试...\`);
        } else if (charCount < 6000 && attempt >= 3) {
           newLogs.push(\`[第 \${attempt} 次尝试] 返回字数：\${charCount}。已达重试上限，保留当前结果。\`);
        } else {
           newLogs.push(\`[第 \${attempt} 次尝试] 返回字数：\${charCount}。字数达标，任务完成。\`);
        }
      }

      updateTasks(prev => prev.map(t => {
        if (t.id === task.id) {
          const updatedTask = {
            ...t,
            filename: t.filename.startsWith('task_') ? filename : t.filename,
            subResults,
            retryLogs: newLogs,
            retryCount: attempt,
            status: (isCompleted ? 'completed' : 'step1_completed') as TaskStatus
          };
          return updatedTask;
        }
        return t;
      }));

      if (needsRetry) {
        setTimeout(() => {
          runSingleGeneration(task, attempt + 1, newLogs);
        }, 1500);
      }

    } catch (error) {`;

content = content.replace(regex, replacement);

// We also need to add the UI elements to display the retry logs.
// Let's find where the task is rendered and add the logs.
// Specifically in the "Completed View" or just above it.

const uiRegex = /\{task\.status === 'completed' && task\.subResults\.length > 0 && \(\s*<div className="h-full bg-white\/60 rounded-lg p-3">/g;

const uiReplacement = `
                          {/* Logs View */}
                          {task.retryLogs && task.retryLogs.length > 0 && (
                            <div className="mb-2 space-y-1">
                              {task.retryLogs.map((log, i) => (
                                <div key={i} className="text-[10px] text-slate-500 bg-slate-50 p-1.5 rounded border border-slate-100 flex items-center">
                                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mr-1.5"></span>
                                  {log}
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {/* Generated Text View (always show if we have results, so we can see intermediate steps) */}
                          {task.subResults.length > 0 && (
                            <div className="h-full bg-white/60 rounded-lg p-3">`;

content = content.replace(uiRegex, uiReplacement);

// Also we need to change {task.status === 'completed' && task.subResults.length > 0 && (
// to just {task.subResults.length > 0 && (
// Wait, the uiRegex matched that specifically.

fs.writeFileSync('src/App.tsx', content);

