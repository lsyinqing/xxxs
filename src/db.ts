import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { SingleTask } from './types';

interface AppDB extends DBSchema {
  singleTasks: {
    key: string;
    value: SingleTask;
  };
}

let dbPromise: Promise<IDBPDatabase<AppDB>>;

export function initDB() {
  if (!dbPromise) {
    dbPromise = openDB<AppDB>('AppDatabase', 1, {
      upgrade(db) {
        db.createObjectStore('singleTasks', { keyPath: 'id' });
      },
    });
  }
  return dbPromise;
}

export async function saveTaskToHistory(task: SingleTask) {
  const db = await initDB();
  await db.put('singleTasks', task);
}

export async function getTasksFromHistory(): Promise<SingleTask[]> {
  const db = await initDB();
  return db.getAll('singleTasks');
}

export async function clearTaskHistory() {
  const db = await initDB();
  await db.clear('singleTasks');
}
