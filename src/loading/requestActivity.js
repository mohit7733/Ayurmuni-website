const listeners = new Set();
let inflight = 0;

const emit = () => {
  listeners.forEach((listener) => listener(inflight));
};

export const beginRequest = () => {
  inflight += 1;
  emit();
};

export const endRequest = () => {
  inflight = Math.max(0, inflight - 1);
  emit();
};

export const inflightCount = () => inflight;

export const subscribeRequests = (listener) => {
  listeners.add(listener);
  listener(inflight);
  return () => listeners.delete(listener);
};
