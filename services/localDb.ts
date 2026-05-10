
import Dexie, { Table } from 'dexie';
import { TimeLog, AppSettings, AppUser, Absence, UserDocument } from '../types';

export interface SyncQueueItem {
  id?: number;
  type: 'LOG' | 'SETTINGS' | 'USER' | 'ABSENCE' | 'DOCUMENT_META';
  action: 'UPSERT' | 'DELETE';
  entityId: string;
  data: any;
  timestamp: number;
}

export class AppDatabase extends Dexie {
  timeLogs!: Table<TimeLog>;
  settings!: Table<AppSettings & { user_id: string }>;
  users!: Table<AppUser>;
  absences!: Table<Absence>;
  documents!: Table<UserDocument>;
  syncQueue!: Table<SyncQueueItem>;

  constructor() {
    super('PontoInteligenteDB');
    this.version(1).stores({
      timeLogs: 'id, date, user_id',
      settings: 'user_id',
      users: 'id, name',
      absences: 'id, date, user_id, time_log_id',
      documents: 'id, user_id',
      syncQueue: '++id, type, entityId, timestamp'
    });
  }
}

export const dbLocal = new AppDatabase();

export const addToSyncQueue = async (item: Omit<SyncQueueItem, 'timestamp'>) => {
  await dbLocal.syncQueue.add({
    ...item,
    timestamp: Date.now()
  });
};
