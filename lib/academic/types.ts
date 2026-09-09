export type Provider = 'brightspace' | 'gradescope';
export type Course = { id: string; name: string; url: string };
export type Assignment = { id: string; courseId: string; courseName: string; title: string; url: string; due: string | null; dueAt?: string | null; submitted?: boolean };
export type Grade = { id: string; courseId: string; courseName: string; title: string; value: string };
export type Snapshot = {
  courses: Course[]; assignments: Assignment[]; grades: Grade[]; syncedAt: string;
  coverage: { assignments: boolean; grades: boolean };
};
export type ConnectionView = {
  available: boolean; state: 'disconnected' | 'opening' | 'awaiting_login' | 'syncing' | 'connected';
  expiresAt?: string; snapshot?: Snapshot; searchReady?: boolean; message?: string;
};
