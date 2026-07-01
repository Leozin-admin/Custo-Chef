/* =========================================================
   auth.js — lógica de login, cadastro e recuperação
   ========================================================= */

const API = (function () {
  const host = window.location.hostname;
  if (host === 'localhost' || host.startsWith('127.')) {
    return 'http://localhost:3000';
  }
  return window.location.origin;
})();

// Lê token da URL (caso venha do link de recuperação)
const urlParams = new URLSearchParams(window.location.search);
const tokenFromUrl = urlParams.get('token');

function mostrarTela(id) {
  ['tela-login', 'tela-cadastro', 'tela-recuperar', 'tela-redefinir'].forEach(t => {
    const el = document.getElementById(t);
    if (el) el.style.display = t === id ? 'block' : 'none';
  });
}

function mostrarCadastro() { mostrarTela('tela-cadastro'); }
function mostrarLogin() { mostrarTela('tela-login'); }
function mostrarRecuperar() { mostrarTela('tela-recuperar'); }
function mostrarRedefinir() { mostrarTela('tela-redefinir'); }

function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  const text = btn.querySelector('.btn-text');
  const spin = btn.querySelector('.btn-spinner');
  if (text) text.style.display = loading ? 'none' : 'inline';
  if (spin) spin.style.display = loading ? 'inline' : 'none';
}

function setMsg(id, texto, sucesso = false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = texto;
  el.className = sucesso ? 'mensagem sucesso' : 'mensagem';
}

async function fazerCadastro() {
  const nome = document.getElementById('cad-nome').value.trim();
  const email = document.getElementById('cad-email').value.trim();
  const senha = document.getElementById('cad-senha').value;
  setMsg('cad-msg', '');

  if (!nome || !email || !senha) { setMsg('cad-msg', 'Preencha todos os campos.'); return; }
  if (senha.length < 6) { setMsg('cad-msg', 'A senha deve ter pelo menos 6 caracteres.'); return; }

  setLoading('btn-cadastro', true);
  try {
    const res = await fetch(API + '/auth/cadastro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, email, senha })
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      localStorage.setItem('token', data.token);
      if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
      setMsg('cad-msg', 'Cadastrado! Redirecionando...', true);
      setTimeout(() => { window.location.href = '../dashboard/index.html'; }, 800);
    } else {
      setMsg('cad-msg', data.message || 'Erro ao cadastrar.');
    }
  } catch {
    setMsg('cad-msg', 'Servidor offline. Tente novamente.');
  } finally {
    setLoading('btn-cadastro', false);
  }
}

async function fazerLogin() {
  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-senha').value;
  setMsg('login-msg', '');

  if (!email || !senha) { setMsg('login-msg', 'Preencha e-mail e senha.'); return; }

  setLoading('btn-login', true);
  try {
    const res = await fetch(API + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha })
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      localStorage.setItem('token', data.token);
      if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
      setMsg('login-msg', 'Login realizado! Redirecionando...', true);
      setTimeout(() => { window.location.href = '../dashboard/index.html'; }, 600);
    } else {
      setMsg('login-msg', data.message || 'Erro ao fazer login.');
    }
  } catch {
    setMsg('login-msg', 'Servidor offline. Tente novamente.');
  } finally {
    setLoading('btn-login', false);
  }
}

async function fazerRecuperar() {
  const email = document.getElementById('rec-email').value.trim();
  setMsg('rec-msg', '');

  if (!email) { setMsg('rec-msg', 'Digite seu email.'); return; }

  setLoading('btn-recuperar', true);
  try {
    const res = await fetch(API + '/auth/recuperar-senha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      setMsg('rec-msg', 'Se o email existir, você receberá o link em instantes. (Verifique o console do servidor)', true);
      document.getElementById('rec-email').value = '';
    } else {
      setMsg('rec-msg', data.message || 'Erro ao processar.');
    }
  } catch {
    setMsg('rec-msg', 'Servidor offline.');
  } finally {
    setLoading('btn-recuperar', false);
  }
}

async function fazerRedefinir() {
  const novaSenha = document.getElementById('nova-senha').value;
  const confirma = document.getElementById('confirma-senha').value;
  setMsg('redef-msg', '');

  if (!novaSenha || !confirma) { setMsg('redef-msg', 'Preencha ambos os campos.'); return; }
  if (novaSenha.length < 6) { setMsg('redef-msg', 'A senha deve ter pelo menos 6 caracteres.'); return; }
  if (novaSenha !== confirma) { setMsg('redef-msg', 'As senhas não conferem.'); return; }

  if (!tokenFromUrl) { setMsg('redef-msg', 'Token inválido. Use o link do email.'); return; }

  setLoading('btn-redefinir', true);
  try {
    const res = await fetch(API + '/auth/redefinir-senha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenFromUrl, novaSenha })
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      setMsg('redef-msg', 'Senha redefinida! Faça login.', true);
      setTimeout(() => {
        window.location.href = window.location.pathname; // limpa ?token
      }, 1500);
    } else {
      setMsg('redef-msg', data.message || 'Erro ao redefinir.');
    }
  } catch {
    setMsg('redef-msg', 'Servidor offline.');
  } finally {
    setLoading('btn-redefinir', false);
  }
}

// Se veio com token na URL, abre tela de redefinir
if (tokenFromUrl) {
  mostrarRedefinir();
}

// Se já tem token válido, redireciona pro dashboard
if (localStorage.getItem('token') && !tokenFromUrl) {
  window.location.href = '../dashboard/index.html';
}

// Verifica se deve abrir direto na tela de cadastro
const params = new URLSearchParams(window.location.search);
if (params.get('tela') === 'cadastro') {
  mostrarCadastro();
}