import { BaseUrl } from '../config/key';

const normalizeBase = (url) => String(url || '').replace(/\/+$/, '');

export const API_BASE = normalizeBase(BaseUrl.base_url);

const productionHost = normalizeBase(
  import.meta.env.VITE_API_BASE || 'https://ayurmuni.aimantra.info/',
);

export const WS_BASE = import.meta.env.DEV
  ? `${typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${
      typeof window !== 'undefined' ? window.location.host : 'localhost:5173'
    }`
  : normalizeBase(productionHost)
      .replace(/^https:/i, 'wss:')
      .replace(/^http:/i, 'ws:');
