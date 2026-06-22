// ============================================================
// store.js - State Management
// ============================================================

const Store = (() => {
  const KEY_TOKEN = 'rri_token';
  const KEY_USER = 'rri_user';
  const KEY_EXPIRES = 'rri_expires';

  let _state = {
    user: null,
    token: null,
    notifications: [],
    unreadCount: 0,
  };

  const _listeners = {};

  function on(event, cb) {
    if (!_listeners[event]) _listeners[event] = [];
    _listeners[event].push(cb);
  }

  function emit(event, data) {
    (_listeners[event] || []).forEach(cb => {
      try { cb(data); } catch (e) { console.error('Store emit error:', e); }
    });
  }

  function setSession(token, user, expiresAt) {
    _state.token = token;
    _state.user = user;
    localStorage.setItem(KEY_TOKEN, token);
    localStorage.setItem(KEY_USER, JSON.stringify(user));
    if (expiresAt) localStorage.setItem(KEY_EXPIRES, expiresAt);
    emit('auth', { user, token });
  }

  function clearSession() {
    _state.token = null;
    _state.user = null;
    localStorage.removeItem(KEY_TOKEN);
    localStorage.removeItem(KEY_USER);
    localStorage.removeItem(KEY_EXPIRES);
    emit('auth', null);
  }

  function loadSession() {
    const token = localStorage.getItem(KEY_TOKEN);
    const userStr = localStorage.getItem(KEY_USER);
    const expires = localStorage.getItem(KEY_EXPIRES);

    if (token && userStr) {
      if (expires && new Date(expires) < new Date()) {
        clearSession();
        return false;
      }
      _state.token = token;
      _state.user = JSON.parse(userStr);
      return true;
    }
    return false;
  }

  function getToken() { return _state.token || localStorage.getItem(KEY_TOKEN); }
  function getUser() { return _state.user; }
  function isLoggedIn() { return !!getToken(); }
  function hasRole(roles) {
    const u = getUser();
    if (!u) return false;
    if (typeof roles === 'string') return u.role === roles;
    return roles.includes(u.role);
  }

  function setNotifications(items, unread) {
    _state.notifications = items;
    _state.unreadCount = unread;
    emit('notifications', { items, unread });
  }

  function getState() { return { ..._state }; }

  return {
    setSession, clearSession, loadSession,
    getToken, getUser, isLoggedIn, hasRole,
    setNotifications, getState,
    on, emit,
  };
})();

// ============================================================
// cache.js - Client-side cache dengan TTL
// ============================================================

const Cache = (() => {
  const store = new Map();
  const DEFAULT_TTL = 60 * 1000; // 1 menit

  function set(key, value, ttl) {
    store.set(key, {
      value,
      expires: Date.now() + (ttl || DEFAULT_TTL),
    });
  }

  function get(key) {
    const item = store.get(key);
    if (!item) return null;
    if (item.expires < Date.now()) {
      store.delete(key);
      return null;
    }
    return item.value;
  }

  function invalidate(prefix) {
    if (!prefix) { store.clear(); return; }
    for (const key of store.keys()) {
      if (key.startsWith(prefix)) store.delete(key);
    }
  }

  async function getOrFetch(key, fetchFn, ttl) {
    const cached = get(key);
    if (cached !== null) return cached;
    const fresh = await fetchFn();
    set(key, fresh, ttl);
    return fresh;
  }

  return { set, get, invalidate, getOrFetch };
})();

// ============================================================
// router.js - SPA Router
// ============================================================

const Router = (() => {
  const routes = {};
  let currentRoute = null;
  let beforeEach = null;

  function register(path, handler) {
    routes[path] = handler;
  }

  function before(guard) {
    beforeEach = guard;
  }

  async function navigate(path, params) {
    const cleanPath = path.split('?')[0];

    if (beforeEach) {
      const allowed = await beforeEach(cleanPath, params);
      if (!allowed) return;
    }

    const handler = routes[cleanPath] || routes['*'];
    if (!handler) {
      console.warn('No route for:', cleanPath);
      return;
    }

    currentRoute = { path: cleanPath, params };

    // Update URL hash
    const hash = params
      ? cleanPath + '?' + new URLSearchParams(params).toString()
      : cleanPath;
    history.pushState({ path: cleanPath, params }, '', '#' + hash);

    try {
      await handler(params || {});
    } catch (e) {
      console.error('Route handler error:', e);
      UI.toast('Terjadi kesalahan saat memuat halaman', 'error');
    }
  }

  function getCurrentRoute() { return currentRoute; }

  function init() {
    window.addEventListener('popstate', (e) => {
      const state = e.state;
      if (state && state.path) {
        const handler = routes[state.path] || routes['*'];
        if (handler) handler(state.params || {});
      }
    });

    // Handle initial hash
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      const [path, qs] = hash.split('?');
      const params = qs ? Object.fromEntries(new URLSearchParams(qs)) : {};
      navigate(path, params);
    } else {
      navigate('/');
    }
  }

  return { register, before, navigate, getCurrentRoute, init };
})();
