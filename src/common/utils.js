const PREFIX = 'ayurmuni_';
// Fired when the access token is written or removed (login, logout, account switch) so the
// API cache and long-lived providers can drop the previous account's data.
export const SESSION_EVENT = 'ayurmuni:session';
const SESSION_KEYS = new Set(['_TOKEN']);
const emitSession = (key) => {
  if (key !== undefined && !SESSION_KEYS.has(key)) return;
  try {
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(SESSION_EVENT));
  } catch {
    // non-browser
  }
};

export const Utils = {
  async storeData(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch (e) {
      console.log(e);
    }
    emitSession(key);
  },

  async getData(key) {
    try {
      const jsonValue = localStorage.getItem(PREFIX + key);
      return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch {
      return null;
    }
  },

  async storeStringData(key, value) {
    try {
      localStorage.setItem(PREFIX + key, value);
    } catch (e) {
      console.log(e);
    }
  },

  async getStringData(key) {
    try {
      return localStorage.getItem(PREFIX + key);
    } catch {
      return null;
    }
  },

  async clearAllData() {
    try {
      const keys = Object.keys(localStorage).filter((k) =>
        k.startsWith(PREFIX),
      );
      keys.forEach((k) => localStorage.removeItem(k));
      emitSession();
      return true;
    } catch (e) {
      console.log(e);
    }
  },

  async removeData(key) {
    try {
      localStorage.removeItem(PREFIX + key);
    } catch (e) {
      console.log(e);
    }
    emitSession(key);
  },

  notNull(val) {
    return (
      val !== null &&
      val !== undefined &&
      val !== 'NULL' &&
      val !== 'null' &&
      val !== 'undefined' &&
      val !== 'UNDEFINED' &&
      (val + '').trim() !== ''
    );
  },
};
