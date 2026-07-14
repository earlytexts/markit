/**
 * A generic trailing-edge debouncer keyed by K, carrying a value V through to
 * the callback. Value-carrying (not key-only) so callers can close over a
 * live object at trigger time rather than re-fetching it when the timer fires.
 */

export type KeyedDebouncer<K, V> = {
  trigger: (key: K, value: V) => void;
  cancel: (key: K) => void;
};

export default <K, V>(
  delayMs: number,
  fn: (key: K, value: V) => void,
): KeyedDebouncer<K, V> => {
  const pending = new Map<K, NodeJS.Timeout>();

  return {
    trigger: (key, value) => {
      clearTimeout(pending.get(key));
      pending.set(
        key,
        setTimeout(() => {
          pending.delete(key);
          fn(key, value);
        }, delayMs),
      );
    },
    cancel: (key) => {
      clearTimeout(pending.get(key));
      pending.delete(key);
    },
  };
};
