import { loadGardenLexicon } from './library';
import { generateGardenLevel } from './generator';
import type { WordGardenLevel, WordGardenMode } from './model';

let worker: Worker | undefined;
const requests = new Map<string, { resolve: (level: WordGardenLevel) => void; reject: (error: Error) => void }>();
function getWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null;
  if (!worker) {
    try { worker = new Worker(new URL('./word-garden.worker.ts', import.meta.url), { type: 'module' }); }
    catch { return null; }
    worker.onmessage = event => {
      const request = requests.get(event.data.id);
      if (!request) return;
      requests.delete(event.data.id);
      if (event.data.error) request.reject(new Error(event.data.error)); else request.resolve(event.data.level);
    };
    worker.onerror = () => resetWorker(() => new Error('WORD_GARDEN_WORKER_FAILED'));
  }
  return worker;
}
// İlişib qalmış və ya artıq lazım olmayan worker yaddaşda (leksikon + generator) qalmasın
function resetWorker(reason: () => Error) {
  worker?.terminate(); worker = undefined;
  const pending = [...requests.values()];
  requests.clear();
  for (const request of pending) request.reject(reason());
}
/** Oyun ekranı bağlananda worker-i dayandırır; növbəti sorğu yenisini yaradır. */
export function disposeGardenWorker() {
  resetWorker(() => new DOMException('Aborted', 'AbortError'));
}
export async function loadGardenLevel(language: string, level: number, mode: WordGardenMode, signal?: AbortSignal, revision?: string): Promise<WordGardenLevel> {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const current = getWorker();
  if (!current) {
    const lexicon = await loadGardenLexicon(language, revision);
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    return generateGardenLevel(lexicon, level, mode);
  }
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const cancel = () => { requests.delete(id); clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
    const timer = setTimeout(() => {
      requests.delete(id); signal?.removeEventListener('abort', cancel); reject(new Error('WORD_GARDEN_GENERATION_TIMEOUT'));
      // Cavab verməyən worker CPU/yaddaşı tutmağa davam etməsin
      if (worker === current) resetWorker(() => new Error('WORD_GARDEN_WORKER_FAILED'));
    }, 15000);
    const finish = (action: () => void) => { clearTimeout(timer); signal?.removeEventListener('abort', cancel); action(); };
    requests.set(id, { resolve: value => finish(() => resolve(value)), reject: error => finish(() => reject(error)) });
    signal?.addEventListener('abort', cancel, { once: true });
    try { current.postMessage({ id, language, level, mode, revision }); }
    catch {
      requests.delete(id);
      finish(() => reject(new Error('WORD_GARDEN_WORKER_FAILED')));
    }
  });
}
