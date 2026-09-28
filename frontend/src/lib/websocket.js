export const buildWebSocketUrl = (path, params = {}) => {
  const configuredBackend = process.env.REACT_APP_BACKEND_URL || window.location.origin;
  const base = new URL(configuredBackend, window.location.origin);
  base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
  base.pathname = path.startsWith('/') ? path : `/${path}`;
  base.search = '';
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      base.searchParams.set(key, String(value));
    }
  });
  return base.toString();
};
