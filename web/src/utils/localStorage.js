export const readStoredJSON = (key) => {
  try {
    return JSON.parse(window.localStorage.getItem(key));
  } catch {
    return null;
  }
};

export const writeStoredJSON = (key, value) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be unavailable or full; the page should still work.
  }
};

export const removeStoredItem = (key) => {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage may be unavailable; the page should still work.
  }
};