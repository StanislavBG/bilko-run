type Listener<T> = (payload: T) => void;

export function createBus<E extends Record<string, unknown>>() {
  const subs = new Map<keyof E, Set<Listener<unknown>>>();
  return {
    on<K extends keyof E>(ev: K, fn: Listener<E[K]>): () => void {
      let s = subs.get(ev);
      if (!s) { s = new Set(); subs.set(ev, s); }
      s.add(fn as Listener<unknown>);
      return () => { s!.delete(fn as Listener<unknown>); };
    },
    emit<K extends keyof E>(ev: K, p: E[K]): void {
      subs.get(ev)?.forEach(fn => (fn as Listener<E[K]>)(p));
    },
    off<K extends keyof E>(ev: K, fn: Listener<E[K]>): void {
      subs.get(ev)?.delete(fn as Listener<unknown>);
    },
  };
}
