let navigateFn = null;

export const setNavigate = (fn) => {
  navigateFn = fn;
};

export const navigate = (path, state) => {
  if (navigateFn) {
    navigateFn(path, { state, replace: false });
    return;
  }
  window.location.assign(path);
};

export const replace = (path, state) => {
  if (navigateFn) {
    navigateFn(path, { state, replace: true });
    return;
  }
  window.location.replace(path);
};

export const goBack = () => {
  if (window.history.length > 1) {
    window.history.back();
    return;
  }
  replace('/login');
};
