/* =========================================================
   landing.js — lógica da landing (SlimTrack)
   ========================================================= */

// ===== REVEAL ON SCROLL =====
const obs = new IntersectionObserver((entries) => {
  entries.forEach((e, i) => {
    if (e.isIntersecting) setTimeout(() => e.target.classList.add('visible'), i * 100);
  });
}, { threshold: 0.1 });
document.querySelectorAll('.reveal').forEach(el => obs.observe(el));

// ===== HEADER DINÂMICO: mostra apelido do usuário logado =====
const API = 'http://localhost:3000';
const navEntrar = document.getElementById('nav-entrar');
const navLinks = navEntrar ? navEntrar.parentElement : null;

function primeiroNome(nome) {
  if (!nome) return 'amigo';
  return String(nome).trim().split(/\s+/)[0];
}

function renderUsuarioLogado(nome) {
  if (!navLinks) return;
  // esconde o botão "Entrar" e os links públicos
  document.querySelectorAll('.nav-links a').forEach(a => {
    if (a.id !== 'nav-entrar') a.style.display = 'none';
  });
  navEntrar.style.display = 'none';

  const userBox = document.createElement('div');
  userBox.className = 'nav-user';
  userBox.innerHTML = `
    <span>👋 Olá, <span id="nav-nome"></span></span>
    <button class="nav-logout" id="nav-logout">Sair</button>
  `;
  navLinks.appendChild(userBox);
  document.getElementById('nav-nome').textContent = primeiroNome(nome);

  document.getElementById('nav-logout').addEventListener('click', () => {
    localStorage.removeItem('token');
    window.location.reload();
  });
}

async function checarLogin() {
  const token = localStorage.getItem('token');
  if (!token || !navLinks) return;

  try {
    const res = await fetch(API + '/perfil', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem('token');
      return;
    }
    if (res.ok) {
      const data = await res.json();
      renderUsuarioLogado(data.nome);
    }
  } catch (err) {
    // servidor offline → mantém o botão "Entrar" padrão
  }
}

checarLogin();