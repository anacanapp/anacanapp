/** Deterministic Web Storage quota, including atomic replacement semantics. */
export class QuotaStorage implements Storage {
  private values = new Map<string, string>();
  limit = Number.POSITIVE_INFINITY;
  get length() { return this.values.size; }
  get size() { return [...this.values].reduce((sum, [key, value]) => sum + 2 * (key.length + value.length), 0); }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
  setItem(key: string, value: string) {
    const old = this.values.get(key);
    const size = this.size - (old === undefined ? 0 : 2 * (key.length + old.length)) + 2 * (key.length + value.length);
    if (size > this.limit) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    this.values.set(key, value);
  }
}
