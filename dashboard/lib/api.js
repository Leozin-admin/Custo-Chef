/* =========================================================
   api.js — helper compartilhado de API
   - Detecta automaticamente o host (localhost em dev, mesmo host em prod)
   - fetchAuth(): fetch com Authorization + refresh automático em 401/403
   - Token management (get/set/clear)
   ========================================================= */

const API = (function () {
  const host = window.location.hostname;
  // Em dev local (localhost/127.0.0.1) usa localhost:3000
  if (host === 'localhost' || host.startsWith('127.')) {
    return 'http://localhost:3000';
  }
  // Em produção, o backend mora no Railway
  return 'https://custo-chef-production.up.railway.app';
})();

const TokenStore = {
  get() { return localStorage.getItem('token'); },
  getRefresh() { return localStorage.getItem('refreshToken'); },
  set(token, refresh) {
    localStorage.setItem('token', token);
    if (refresh) localStorage.setItem('refreshToken', refresh);
  },
  clear() {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
  }
};

let refreshPromise = null;

async function tryRefresh() {
  const refresh = TokenStore.getRefresh();
  if (!refresh) return false;
  if (refreshPromise) return refreshPromise;

  refreshPromise = fetch(API + '/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: refresh })
  })
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (data && data.token) {
        TokenStore.set(data.token, refresh);
        return true;
      }
      TokenStore.clear();
      return false;
    })
    .catch(() => false)
    .finally(() => { refreshPromise = null; });

  return refreshPromise;
}

/**
 * fetchAuth — fetch autenticado com refresh automático.
 * Aceita as mesmas opções do fetch + extras:
 *   _retried: controle interno (não passar)
 *   _skipRefresh: true para não tentar refresh (ex: tela de login)
 */
async function fetchAuth(url, options = {}) {
  if (options._skipRefresh) {
    return fetch(url, options);
  }

  const headers = { ...(options.headers || {}) };
  const token = TokenStore.get();
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const opts = { ...options, headers };

  let res = await fetch(url, opts);

  if ((res.status === 401 || res.status === 403) && !options._retried) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      const headers2 = { ...(options.headers || {}) };
      const token2 = TokenStore.get();
      if (token2) headers2['Authorization'] = 'Bearer ' + token2;
      res = await fetch(url, { ...options, headers: headers2, _retried: true });
    } else {
      // Refresh falhou: limpa tokens e manda pro login
      TokenStore.clear();
      // Só redireciona se estivermos no dashboard
      if (window.location.pathname.includes('/dashboard/')) {
        window.location.href = '../auth/index.html';
      }
    }
  }
  return res;
}

function logout() {
  TokenStore.clear();
  window.location.href = '../auth/index.html';
}

// Expõe globalmente
window.API = API;
window.TokenStore = TokenStore;
window.fetchAuth = fetchAuth;
window.logout = logout;

async function iniciarCheckout(plano) {
  const res = await fetchAuth(API + '/billing/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plano })
  });
  const data = await res.json();
  if (data.url) window.location.href = data.url;
}

async function abrirPortalCobranca() {
  const res = await fetchAuth(API + '/billing/portal', {
    method: 'POST'
  });
  const data = await res.json();
  if (data.url) window.location.href = data.url;
}

window.iniciarCheckout = iniciarCheckout;
window.abrirPortalCobranca = abrirPortalCobranca;
