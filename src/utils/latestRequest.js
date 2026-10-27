/**
 * "Latest request wins" gate for hooks/pages: each begin() aborts the previous request's signal
 * and only the newest token reports isCurrent(), so an older response can never overwrite state
 * written by a newer one (filter switches, search-as-you-type, date tabs, refresh after mutation).
 */
export const createLatestRequest = () => {
  let seq = 0;
  let controller = null;
  return {
    begin() {
      controller?.abort();
      controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const id = ++seq;
      const signal = controller?.signal;
      return {
        id,
        signal,
        isCurrent: () => id === seq && !signal?.aborted,
      };
    },
    /** Abort the in-flight request (unmount / input cleared) and invalidate its token. */
    cancel() {
      seq += 1;
      controller?.abort();
      controller = null;
    },
  };
};
