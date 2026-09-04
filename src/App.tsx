import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Settings, Upload, FileText, Download, Check, Loader2, Trash2, Eye, X } from 'lucide-react';
import { SingleTask, SubResult, TaskStatus } from './types';
import { saveTaskToHistory, getTasksFromHistory, clearTaskHistory } from './db';
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_EXTRA_PROMPT, DEFAULT_KB_PROMPT } from './prompts';

// --- Utility Functions ---

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

// Data Cleaning Pipeline (Data Cleaning Pipeline)
function cleanGeneratedText(text: string): string {
  let cleaned = text;

  // 0. 清理AI回复开头的系统确认废话，例如：【【系统指令确认】...】
  cleaned = cleaned.replace(/^【【?(?:系统指令确认|已?收到指令|已?接收指令|指令已?确认)】?[\s\S]*?】\s*/, '');
  
  // 1. 尝试匹配 "前情解码...正文" 的成块内容 (跨段落)
  // 将前面的 ### 和括号也包含进去（如果有的话）
  cleaned = cleaned.replace(/(?:###\s*)?(?:\[|【|\()?前情(?:解码|提要|回顾)(?:\]|】|\))?[\s\S]*?(?:###\s*)?(?:\[|【|\()?(?:大结局)?正文(?:\]|】|\))?[：:]?/g, '');

  // 2. 如果没有明确的正文标志，但段落中有前情解码，则移除该整段落
  let paragraphs = cleaned.split(/\n\s*\n/);
  const qIdx = paragraphs.findIndex(p => p.match(/前情(?:解码|提要|回顾)/));
  if (qIdx !== -1 && qIdx <= 1) { // 限制在开头部分
    paragraphs.splice(qIdx, 1);
    cleaned = paragraphs.join('\n\n');
  }

  // 3. 兜底删除残留的过渡词
  cleaned = cleaned.replace(/(?:###\s*)?(?:\[|【|\()?(?:大结局)?正文(?:\]|】|\))?[：:]?/g, '');
  cleaned = cleaned.replace(/(?:###\s*)?(?:\[|【|\()?前情(?:解码|提要|回顾)(?:\]|】|\))?[：:]?/g, '');

  // 4. 第二次清洗：特别注意第二遍输出结果中有没有 ###1. 要记得删除
  cleaned = cleaned.replace(/###\s*\d+\.?/g, '');
  
  // 5. 删除残留的空括号结构，比如 ### [] 或 ### 【】 及其内部可能残留的换行
  cleaned = cleaned.replace(/###\s*\[\s*\]/g, '');
  cleaned = cleaned.replace(/###\s*【\s*】/g, '');
  cleaned = cleaned.replace(/###\s*\(\s*\)/g, '');
  
  // 清理单独一行的 ### 
  cleaned = cleaned.replace(/^###\s*$/gm, '');

  // 6. 删除 AI 擅自加的 "第X章"
  cleaned = cleaned.replace(/第[一二三四五六七八九十百千0-9]+章[^\n]*/g, '');
  
  // 清除开头多余的空行
  cleaned = cleaned.replace(/^\s+/, '');
  
  return cleaned.trim();
}

function cleanOriginalText(text: string): string {
  let cleaned = text;
  // Remove "第X章", "[修改后最终结果]", titles
  cleaned = cleaned.replace(/第[一二三四五六七八九十百千0-9]+章.*/g, '');
  cleaned = cleaned.replace(/\[修改后最终结果\]/g, '');
  return cleaned.trim();
}

function extractFilename(generatedText: string): string {
  // Try to match [标题]《xxx》
  const titleMatch = generatedText.match(/\[标题\]《(.*?)》/);
  if (titleMatch && titleMatch[1]) {
    // Clean illegal path characters
    return titleMatch[1].replace(/[<>:"\/\\|?*\x00-\x1F]/g, '').trim() + '_1';
  }
  // Fallback: grab first sentence after [引言导语] or just first sentence
  const introMatch = generatedText.match(/\[引言导语\](.*)/);
  if (introMatch && introMatch[1]) {
    const firstSentence = introMatch[1].split(/[,.!?，。！？]/)[0];
    if (firstSentence) return firstSentence.replace(/[<>:"\/\\|?*\x00-\x1F]/g, '').trim() + '_1';
  }
  const fallbackSentence = generatedText.split(/[,.!?，。！？]/)[0];
  return (fallbackSentence || 'untitled').replace(/[<>:"\/\\|?*\x00-\x1F]/g, '').substring(0, 20).trim() + '_1';
}

export default function App() {
  // --- State ---
  const [systemPrompt, setSystemPrompt] = useState<string>(DEFAULT_SYSTEM_PROMPT);
  const [extraPrompt, setExtraPrompt] = useState<string>(DEFAULT_EXTRA_PROMPT);
  const [kbPrompt, setKbPrompt] = useState<string>(DEFAULT_KB_PROMPT);
  const [candidateCount, setCandidateCount] = useState<number>(2);
  const [autoFlowMode, setAutoFlowMode] = useState<'manual' | 'auto'>('auto');
  
  const [singleTasks, setSingleTasks] = useState<SingleTask[]>([]);
  const [isSingleRunning, setIsSingleRunning] = useState<boolean>(false);
  const runningRef = useRef<boolean>(false);
  const [previewTask, setPreviewTask] = useState<SingleTask | null>(null);
  const [pastedText, setPastedText] = useState<string>('');

  const [modeSnapshot, setModeSnapshot] = useState<any>(null);

  // Load history on mount
  useEffect(() => {
    getTasksFromHistory().then(tasks => {
      if (tasks && tasks.length > 0) {
        // Reset any running tasks to pending on reload
        const resetTasks = tasks.map(t => 
          (t.status === 'step1_running') ? { ...t, status: 'pending' as TaskStatus } : t
        );
        setSingleTasks(resetTasks);
      }
    });
  }, []);

  // Save tasks on change
  const updateTasks = useCallback((newTasks: SingleTask[] | ((prev: SingleTask[]) => SingleTask[])) => {
    setSingleTasks(prev => {
      const next = typeof newTasks === 'function' ? newTasks(prev) : newTasks;
      // Persist individually or batch? Let's rely on saveToHistory being called on individual updates during processing,
      // but for UI interactions we can persist here.
      next.forEach(t => saveTaskToHistory(t));
      return next;
    });
  }, []);

  // --- Handlers ---
  const handleAddTask = () => {
    if (!pastedText.trim()) return;
    
    // Split by exact 4 hyphens '----'
    const chunks = pastedText.split(/\n\s*-{4}\s*\n/).filter(c => c.trim().length > 0);
    
    // Clean and process chunks
    const newTasks: SingleTask[] = chunks.map((chunk, index) => {
      // 自动清理常见的干扰头部文字
      let cleanedChunk = chunk
        .replace(/\d+\s*人赞同了该回答/g, '')
        .replace(/本回答节选自盐选专栏[，,]?有助于解答该问题/g, '')
        .replace(/本回答节选自盐选专栏/g, '')
        .trim();

      return {
        id: generateId(),
        originalText: cleanedChunk,
        filename: `task_${Date.now()}_${index}`,
        status: 'pending',
        subResults: [],
        createdAt: Date.now() + index
      };
    });

    updateTasks(prev => [...prev, ...newTasks]);
    setPastedText('');
  };

  const getCardColorClasses = (id: string) => {
    const colors = [
      { border: 'border-blue-200', bg: 'bg-blue-50/40', header: 'bg-blue-100/50' },
      { border: 'border-emerald-200', bg: 'bg-emerald-50/40', header: 'bg-emerald-100/50' },
      { border: 'border-amber-200', bg: 'bg-amber-50/40', header: 'bg-amber-100/50' },
      { border: 'border-purple-200', bg: 'bg-purple-50/40', header: 'bg-purple-100/50' },
      { border: 'border-rose-200', bg: 'bg-rose-50/40', header: 'bg-rose-100/50' },
      { border: 'border-indigo-200', bg: 'bg-indigo-50/40', header: 'bg-indigo-100/50' }
    ];
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const handleClearTasks = async () => {
    await clearTaskHistory();
    setSingleTasks([]);
  };

  const handleClearCompletedTasks = async () => {
    const remaining = singleTasks.filter(t => t.status !== 'completed');
    setSingleTasks(remaining);
  };

  const handleClearPendingTasks = async () => {
    const remaining = singleTasks.filter(t => t.status !== 'pending');
    setSingleTasks(remaining);
  };

  const handleDeleteTask = (id: string) => {
    setSingleTasks(prev => prev.filter(t => t.id !== id));
  };

  // The core execution engine
  const runSingleGeneration = async (task: SingleTask, attempt = 1, currentLogs: string[] = []) => {
    updateTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'step1_running' } : t));

    try {
      const startResponse = await fetch('/api/generate/start', {
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
        throw new Error(`API Error: ${startResponse.status} ${errData.error || ""}`);
      }
      
      const { jobId } = await startResponse.json();
      
      let data: any = null;
      while (true) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const statusResponse = await fetch(`/api/generate/status/${jobId}`);
        if (!statusResponse.ok) {
          throw new Error(`Status API Error: ${statusResponse.status}`);
        }
        
        const statusData = await statusResponse.json();
        
        if (statusData.status === 'completed') {
          data = statusData;
          break;
        } else if (statusData.status === 'error') {
          throw new Error(statusData.error);
        }
      }
      
      const textLengths = data.results.map((text: string) => text.replace(/[\r\n]/g, '').length || 0);
      const maxIdx = textLengths.indexOf(Math.max(0, ...textLengths));
      
      const subResults: SubResult[] = data.results.map((text: string, idx: number) => ({
        id: generateId(),
        text,
        isSelected: idx === maxIdx // 自动选中字数最多（达标）的那一个方案
      }));

      // Fallback filename extraction
      const filename = extractFilename(subResults[0]?.text || '');
      const maxCharCount = Math.max(0, ...subResults.map(sr => sr.text.replace(/[\r\n]/g, '').length || 0));
      
      let isCompleted = modeSnapshot.autoFlowMode === 'auto';
      let needsRetry = false;
      const newLogs = [...currentLogs];

      if (modeSnapshot.autoFlowMode === 'auto') {
        if (maxCharCount < 5500 && attempt < 3) { 
           needsRetry = true;
           isCompleted = false;
           newLogs.push(`[第 ${attempt} 次尝试] 最佳字数：${maxCharCount}。低于5500字，准备重试...`);
        } else if (maxCharCount < 5500 && attempt >= 3) { 
           newLogs.push(`[第 ${attempt} 次尝试] 最佳字数：${maxCharCount}。已达重试上限，保留当前结果。`);
        } else { 
           newLogs.push(`[第 ${attempt} 次尝试] 最佳字数：${maxCharCount}。字数达标，任务完成。`);
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

    } catch (error) {
      console.error("Failed to generate for task", task.id, error);
      updateTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'pending' } : t)); // revert
    }
  };

  // Loop processing
  useEffect(() => {
    if (!isSingleRunning) return;

    const runningCount = singleTasks.filter(t => t.status === 'step1_running').length;
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
  }, [isSingleRunning, singleTasks, modeSnapshot]);

  const handleStartWorkflow = () => {
    if (singleTasks.length === 0) return;
    
    // 锁定当前的模式快照
    setModeSnapshot({
      systemPrompt,
      extraPrompt,
      kbPrompt,
      candidateCount,
      autoFlowMode
    });
    
    setIsSingleRunning(true);
  };

  const handleStopWorkflow = () => {
    setIsSingleRunning(false);
  };

  const handleToggleCandidateSelection = (taskId: string, subResultId: string) => {
    updateTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          subResults: t.subResults.map(sr => 
            sr.id === subResultId ? { ...sr, isSelected: !sr.isSelected } : sr
          )
        };
      }
      return t;
    }));

    setPreviewTask(prev => {
      if (!prev || prev.id !== taskId) return prev;
      return {
        ...prev,
        subResults: prev.subResults.map(sr => 
          sr.id === subResultId ? { ...sr, isSelected: !sr.isSelected } : sr
        )
      };
    });
  };

  const handleConfirmDecision = () => {
    if (!previewTask) return;
    const selectedSubs = previewTask.subResults.filter(s => s.isSelected);
    if (selectedSubs.length === 0) {
      alert('请至少勾选一个中间结果！');
      return;
    }
    
    handleConfirmTask(previewTask.id);
    setPreviewTask(null);
  };

  const handleConfirmTask = (taskId: string) => {
    updateTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'completed' } : t));
  };

  const handleExportAll = async () => {
    const completedTasks = singleTasks.filter(t => t.status === 'completed');
    if (completedTasks.length === 0) {
      alert("没有已完成的任务可以导出！");
      return;
    }

    const zip = new JSZip();

    completedTasks.forEach((task, index) => {
      const selected = task.subResults.find(sr => sr.isSelected);
      if (!selected) return;

      const finalOriginal = `### 1\n${cleanOriginalText(task.originalText)}`;
      const finalGenerated = `### 2\n${cleanGeneratedText(selected.text)}`;
      const combinedContent = `${finalOriginal}\n\n${finalGenerated}`;
      
      const safeFilename = task.filename.replace(/[/\\?%*:|"<>]/g, '-');
      zip.file(`${safeFilename}.txt`, combinedContent);
    });

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `Batch_Export_${Date.now()}.zip`;
    a.click();
    
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 60000);

    updateTasks(prev => prev.map(t => 
      t.status === 'completed' ? { ...t, isDownloaded: true } : t
    ));
  };

  const handleExportText = (task: SingleTask) => {
    const selected = task.subResults.find(sr => sr.isSelected);
    if (!selected) return;

    // 清洗、合并与导出
    const finalOriginal = `### 1\n${cleanOriginalText(task.originalText)}`;
    const finalGenerated = `### 2\n${cleanGeneratedText(selected.text)}`;
    
    const combinedContent = `${finalOriginal}\n\n${finalGenerated}`;

    const blob = new Blob([combinedContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${task.filename}.txt`;
    a.click();
    
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 60000);
    
    updateTasks(prev => prev.map(t => 
      t.id === task.id ? { ...t, isDownloaded: true } : t
    ));
  };

  return (
    <div className="h-screen bg-slate-50 text-slate-900 font-sans p-6 overflow-hidden flex flex-col">
      <div className="w-full max-w-[98%] mx-auto flex flex-col h-full space-y-6 min-h-0">
        
        <header className="flex-shrink-0 flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">单节点工具 (Single Node Engine)</h1>
            <p className="text-sm text-slate-500 mt-1">一步到位的高效文本处理引擎</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button 
                onClick={() => setAutoFlowMode('auto')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${autoFlowMode === 'auto' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
              >全自动</button>
              <button 
                onClick={() => setAutoFlowMode('manual')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${autoFlowMode === 'manual' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
              >手动决策</button>
            </div>
            {isSingleRunning ? (
              <button onClick={handleStopWorkflow} className="flex items-center space-x-2 bg-rose-500 hover:bg-rose-600 text-white px-5 py-2.5 rounded-lg font-medium transition-colors shadow-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>停止运行</span>
              </button>
            ) : (
              <button onClick={handleStartWorkflow} disabled={singleTasks.length === 0} className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-lg font-medium transition-colors shadow-sm">
                <Play className="w-4 h-4" />
                <span>开始执行流程</span>
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 space-y-6 flex flex-col min-h-0">
          
          {/* UI blocks for prompt assembly and execution strategy have been hidden per user request */}

          {/* Main Content Area: Queue and Viewer */}
          <div className="flex-1 flex flex-col xl:flex-row gap-6 items-stretch min-h-0">
            
            {/* Input Area */}
            <div className="w-full xl:w-[400px] flex-shrink-0 bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex flex-col h-full">
              <div className="flex justify-between items-center mb-3 shrink-0">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center"><Upload className="w-4 h-4 mr-2"/> 数据摄入</h2>
              </div>
              <div className="flex flex-col space-y-3 flex-1 min-h-0">
                <textarea 
                  className="flex-1 w-full text-sm p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                  value={pastedText}
                  onChange={e => setPastedText(e.target.value)}
                  placeholder="粘贴原始素材文本... 
（提示：若需一次性压入多个素材，请使用 ---- 独占一行进行分隔）"
                />
                <button 
                  onClick={handleAddTask}
                  disabled={!pastedText.trim()}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shrink-0"
                >
                  压入队列
                </button>
              </div>
            </div>

            {/* Tasks Pool */}
            <div className="flex-1 w-full bg-white p-5 rounded-xl shadow-sm border border-slate-100 min-w-0 flex flex-col h-full">
              <div className="flex justify-between items-center mb-4 shrink-0">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center">
                  <FileText className="w-4 h-4 mr-2"/> 独立任务池 ({singleTasks.length})
                </h2>
                {singleTasks.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={handleExportAll} 
                      className="text-xs font-semibold bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-3 py-1.5 rounded-md transition-colors flex items-center"
                    >
                      <Download className="w-3.5 h-3.5 mr-1" />
                      一键合并下载
                    </button>
                    <div className="h-4 w-px bg-slate-200 mx-1"></div>
                    <button 
                      onClick={handleClearCompletedTasks} 
                      className="text-xs font-medium text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-md transition-colors"
                      title="清理已完成任务"
                    >
                      清空已完成
                    </button>
                    <button 
                      onClick={handleClearPendingTasks} 
                      className="text-xs font-medium text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-md transition-colors"
                      title="清理未处理任务"
                    >
                      清空未处理
                    </button>
                    <button 
                      onClick={handleClearTasks} 
                      className="text-slate-400 hover:text-rose-500 transition-colors p-1.5 ml-1" 
                      title="清空全部"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 overflow-y-auto pr-2 pb-4 min-h-0">
                {singleTasks.length === 0 ? (
                  <div className="col-span-full text-center py-12 text-slate-400 text-sm">
                    队列为空，请先录入数据
                  </div>
                ) : (
                  singleTasks.map(task => {
                    const colors = getCardColorClasses(task.id);
                    return (
                    <div key={task.id} className={`flex flex-col border ${colors.border} ${colors.bg} rounded-xl overflow-hidden shadow-sm hover:shadow transition-shadow h-[280px]`}>
                      {/* Task Header */}
                      <div className={`px-4 py-3 border-b ${colors.border} ${colors.header} flex justify-between items-center shrink-0`}>
                        <div className="flex items-center space-x-3">
                          <span className="text-xs font-bold text-slate-700 truncate max-w-[120px]" title={task.id}>
                            #{task.id.slice(0, 8)}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider
                            ${task.status === 'pending' ? 'bg-white/60 text-slate-600' : ''}
                            ${task.status === 'step1_running' ? 'bg-amber-400 text-white animate-pulse' : ''}
                            ${task.status === 'step1_completed' ? 'bg-indigo-500 text-white shadow-sm' : ''}
                            ${task.status === 'completed' ? 'bg-emerald-500 text-white shadow-sm' : ''}
                          `}>
                            {task.status.replace('step1_', '')}
                          </span>
                          {task.isDownloaded && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-white shadow-sm flex items-center">
                              <Check className="w-3 h-3 mr-1" /> 已下载
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-1">
                          {task.status === 'completed' && (
                            <button 
                              onClick={() => handleExportText(task)}
                              className="text-slate-600 hover:text-slate-900 bg-white/50 hover:bg-white rounded p-1.5 transition-colors"
                              title="下载合并文本"
                            >
                              <Download className="w-3.5 h-3.5"/>
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="text-slate-400 hover:text-rose-500 bg-white/30 hover:bg-white rounded p-1.5 transition-colors"
                            title="删除任务"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      
                      {/* Task Content */}
                      <div className="p-4 flex-1 flex flex-col overflow-hidden">
                        <div className="text-xs text-slate-600 mb-3 line-clamp-3 shrink-0 opacity-80 font-medium">
                          {task.originalText}
                        </div>
                        
                        <div className="flex-1 overflow-y-auto min-h-0 border-t border-black/5 pt-3">
                          {/* Flow Control Manual Selection */}
                          {task.status === 'step1_completed' && (
                            <div className="mt-2 flex h-full items-center justify-center">
                              <button 
                                onClick={() => setPreviewTask(task)}
                                className="w-full py-2.5 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 hover:border-indigo-300 rounded-lg text-sm font-semibold transition-all shadow-sm flex items-center justify-center"
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                决策 (挑选方案)
                              </button>
                            </div>
                          )}

                          {/* Completed View */}
                          
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
                          
                        </div>
                      </div>
                    </div>
                  )})
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      {previewTask && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-7xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800 flex items-center">
                <Eye className="w-5 h-5 mr-2 text-indigo-500" />
                人工决策与对比预览
              </h3>
              <button onClick={() => setPreviewTask(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Body */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left: Original */}
              <div className="w-1/3 border-r border-slate-100 bg-slate-50/50 flex flex-col">
                <div className="px-6 py-3 border-b border-slate-100 bg-slate-100/50 flex justify-between items-center">
                  <span className="font-medium text-sm text-slate-600">原文 / 基础素材</span>
                  <span className="text-xs text-slate-400 font-normal">字数: {previewTask.originalText.replace(/[\r\n]/g, '').length}</span>
                </div>
                <div className="p-6 overflow-y-auto flex-1 text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
                  {previewTask.originalText}
                </div>
              </div>
              
              {/* Right: Candidates */}
              <div className="flex-1 flex flex-col overflow-hidden bg-slate-100/30">
                <div className="px-6 py-3 border-b border-slate-100 bg-slate-100/50 font-medium text-sm text-slate-600">
                  候选方案 (横向对比)
                </div>
                <div className="flex-1 overflow-x-auto p-6">
                  <div className="flex space-x-6 h-full pb-4">
                    {previewTask.subResults.map((sr, idx) => (
                      <div 
                        key={sr.id} 
                        className={`flex-shrink-0 w-[450px] flex flex-col rounded-xl border-2 transition-all duration-200 bg-white shadow-sm ${
                          sr.isSelected ? 'border-indigo-400 ring-4 ring-indigo-50' : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-lg">
                          <div className="flex items-center space-x-3">
                            <span className="font-bold text-slate-700">方案 {idx + 1}</span>
                            <span className="text-xs text-slate-500 font-normal bg-white px-2 py-0.5 rounded border border-slate-200">字数: {sr.text.replace(/[\r\n]/g, '').length}</span>
                          </div>
                          {sr.isSelected && <Check className="w-4 h-4 text-indigo-600" />}
                        </div>
                        <div className="p-5 overflow-y-auto flex-1 text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
                          {sr.text}
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-lg">
                          <label className="flex items-center space-x-3 cursor-pointer group">
                            <input 
                              type="checkbox" 
                              checked={sr.isSelected}
                              onChange={() => handleToggleCandidateSelection(previewTask.id, sr.id)}
                              className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                            <span className="text-sm font-medium text-slate-700 group-hover:text-indigo-600 transition-colors">勾选此版</span>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end bg-white">
              <button 
                onClick={handleConfirmDecision}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors shadow-sm flex items-center"
              >
                <Check className="w-4 h-4 mr-2" />
                确认完成 / 采纳勾选方案
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

