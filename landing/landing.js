/* =========================================================
   landing.js — header dinâmico da landing (CustoChef)
   ========================================================= */

const API = 'http://localhost:3000';

function primeiroNome(nome) {
  if (!nome) return 'amigo';
  return String(nome).trim().split(/\s+/)[0];
}

function renderUsuarioLogado(nome) {
  const entrar = document.getElementById('lp-entrar');
  if (!entrar) return;
  const acoes = entrar.parentElement;
  if (!acoes) return;

  // esconde o botão "Entrar"
  entrar.style.display = 'none';

  // cria box do usuário
  const userBox = document.createElement('div');
  userBox.className = 'lp-user';
  userBox.innerHTML = `
    <span>👋 Olá, <span id="lp-user-nome"></span></span>
    <button class="lp-user-logout" id="lp-logout">Sair</button>
  `;
  acoes.appendChild(userBox);
  document.getElementById('lp-user-nome').textContent = primeiroNome(nome);

  document.getElementById('lp-logout').addEventListener('click', () => {
    localStorage.removeItem('token');
    window.location.reload();
  });
}

async function checarLogin() {
  const token = localStorage.getItem('token');
  if (!token) return;

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
