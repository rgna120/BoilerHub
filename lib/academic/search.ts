import Typesense from 'typesense';
import type { Assignment } from './types';
import { AcademicError } from './config';

function client() {
  const apiKey = process.env.ACADEMIC_TYPESENSE_API_KEY;
  if (!apiKey) return null;
  const url = new URL(process.env.ACADEMIC_TYPESENSE_URL || 'http://127.0.0.1:8108');
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) {
    throw new AcademicError('INVALID_SEARCH_CONFIGURATION', 503);
  }
  return new Typesense.Client({ apiKey, nodes: [{ host: url.hostname, port: Number(url.port || (url.protocol === 'https:' ? 443 : 80)),
    protocol: url.protocol.slice(0, -1) }], connectionTimeoutSeconds: 5, numRetries: 0 });
}
export async function dropIndex(name: string) {
  const service = client();
  if (!service) return;
  try { await service.collections(name).delete(); }
  catch (error) { if ((error as { httpStatus?: number }).httpStatus !== 404) throw error; }
}
// One random, server-chosen collection per connection. No caller-supplied filters,
// collection names, student IDs, or keys. Grades and cookies never enter the index.
export async function indexAssignments(name: string, assignments: Assignment[]): Promise<boolean> {
  const service = client();
  if (!service) return false;
  await dropIndex(name);
  await service.collections().create({ name, fields: [
    { name: 'title', type: 'string' }, { name: 'courseName', type: 'string' },
    { name: 'courseId', type: 'string' }, { name: 'url', type: 'string', index: false },
    { name: 'due', type: 'string', optional: true, index: false },
  ] });
  if (assignments.length) {
    const result = await service.collections(name).documents().import(assignments.map(({ id, title, courseId, courseName, url, due }) => ({ id, title, courseId, courseName, url, ...(due ? { due } : {}) })), { action: 'upsert' });
    if (result.some(row => !row.success)) throw new AcademicError('SEARCH_INDEX_FAILED', 502);
  }
  return true;
}
export async function searchAssignments(name: string, query: string) {
  const service = client();
  if (!service) throw new AcademicError('SEARCH_NOT_CONFIGURED', 503);
  const result = await service.collections<Assignment>(name).documents().search({ q: query || '*',
    query_by: 'title,courseName', per_page: 50 });
  return { found: result.found, assignments: result.hits?.map(hit => hit.document) || [] };
}
