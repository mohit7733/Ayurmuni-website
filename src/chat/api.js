import { BaseUrl } from '../config/key';

const normalizeBase = (url) => String(url || '').replace(/\/+$/, '');

export const API_BASE = normalizeBase(BaseUrl.base_url);

export const WS_BASE = import.meta.env.DEV
  ? `${typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${
      typeof window !== 'undefined' ? window.location.host : 'localhost:5173'
    }`
  : API_BASE.replace(/^https:/i, 'wss:').replace(/^http:/i, 'ws:');
