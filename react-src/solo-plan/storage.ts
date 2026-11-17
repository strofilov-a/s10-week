/* Browser storage of the cabinet, moved out unchanged: every key is prefixed «s10week.», values are JSON, and a
   blocked storage (private mode) is ignored. The Kazan mode (<SoloKazan />) keeps its own keys, «s10week.kazan.…»,
   so it never touches Solo's. Replace this module to keep the same data elsewhere. */
export interface Store {
  get<T = any>(k: string, d?: T): T;
  set(k: string, v: unknown): void;
  /** the full localStorage key of k */
  key(k: string): string;
}

/** a store whose keys are «s10week.» + prefix + key: '' for Solo, 'kazan.' for the Kazan mode */
export function storeFor(prefix: string): Store {
  const key = (k: string): string => 's10week.' + prefix + k;
  return {
    get<T = any>(k: string, d?: T): T {
      try { const v = localStorage.getItem(key(k)); return v ? JSON.parse(v) : (d as T); } catch (e) { return d as T; }
    },
    set(k: string, v: unknown): void {
      try { localStorage.setItem(key(k), JSON.stringify(v)); } catch (e) { /* storage blocked */ }
    },
    key,
  };
}

/** Solo's store («s10week.…»), as before */
export const store: Store = storeFor('');
