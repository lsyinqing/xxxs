export type TaskStatus = 'pending' | 'step1_running' | 'step1_completed' | 'completed';

export interface SubResult {
  id: string;
  text: string;
  isSelected: boolean;
}

export interface SingleTask {
  id: string;
  originalText: string;
  filename: string; // inferred from text or original filename
  status: TaskStatus;
  subResults: SubResult[];
  createdAt: number;
  isDownloaded?: boolean;
  retryLogs?: string[];
  retryCount?: number;
}
