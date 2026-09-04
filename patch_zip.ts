import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

// Ensure JSZip is imported
if (!content.includes("import JSZip")) {
  content = content.replace("import { Download, ", "import JSZip from 'jszip';\nimport { Download, ");
}

const regex = /const handleExportAll = \(\) => \{[\s\S]*?updateTasks\(prev => prev\.map\(t =>/m;

const replacement = `const handleExportAll = async () => {
    const completedTasks = singleTasks.filter(t => t.status === 'completed');
    if (completedTasks.length === 0) {
      alert("没有已完成的任务可以导出！");
      return;
    }

    const zip = new JSZip();

    completedTasks.forEach((task, index) => {
      const selected = task.subResults.find(sr => sr.isSelected);
      if (!selected) return;

      const finalOriginal = \`### 1\\n\${cleanOriginalText(task.originalText)}\`;
      const finalGenerated = \`### 2\\n\${cleanGeneratedText(selected.text)}\`;
      const combinedContent = \`\${finalOriginal}\\n\\n\${finalGenerated}\`;
      
      const safeFilename = task.filename.replace(/[/\\\\?%*:|"<>]/g, '-');
      zip.file(\`\${safeFilename}.txt\`, combinedContent);
    });

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = \`Batch_Export_\${Date.now()}.zip\`;
    a.click();
    
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 60000);

    updateTasks(prev => prev.map(t =>`;

content = content.replace(regex, replacement);

const regexText = />一键合并下载</g;
content = content.replace(regexText, ">一键打包下载<");

fs.writeFileSync('src/App.tsx', content);

