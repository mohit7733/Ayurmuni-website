const PREFIX = 'ayurmuni_';

export const Utils = {
  async storeData(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch (e) {
      console.log(e);
    }
  },

  async getData(key) {
    try {
      const jsonValue = localStorage.getItem(PREFIX + key);
      return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (e) {
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
    } catch (e) {
      return null;
    }
  },

  async clearAllData() {
    try {
      const keys = Object.keys(localStorage).filter((k) =>
        k.startsWith(PREFIX),
      );
      keys.forEach((k) => localStorage.removeItem(k));
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
