/* =========================================================
   auth.js — lógica de login e cadastro
   ========================================================= */

const API = 'http://localhost:3000';

function mostrarCadastro() {
  document.getElementById('tela-login').style.display = 'none';
  document.getElementById('tela-cadastro').style.display = 'block';
}

function mostrarLogin() {
  document.getElementById('tela-cadastro').style.display = 'none';
  document.getElementById('tela-login').style.display = 'block';
}

async function fazerCadastro() {
  const nome = document.getElementById('cad-nome').value.trim();
  const email = document.getElementById('cad-email').value.trim();
  const senha = document.getElementById('cad-senha').value;
  const msg = document.getElementById('cad-msg');
  msg.className = 'mensagem';
  msg.textContent = '';

  if (!nome || !email || !senha) {
    msg.textContent = 'Preencha todos os campos.';
    return;
  }

  try {
    const res = await fetch(API + '/cadastro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, email, senha })
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      msg.className = 'mensagem sucesso';
      msg.textContent = 'Cadastrado! Faça login.';
      document.getElementById('cad-nome').value = '';
      document.getElementById('cad-email').value = '';
      document.getElementById('cad-senha').value = '';
      setTimeout(mostrarLogin, 1500);
    } else {
      msg.textContent = data.message || 'Erro ao cadastrar.';
    }
  } catch {
    msg.textContent = 'Servidor offline.';
  }
}

async function fazerLogin() {
  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-senha').value;
  const msg = document.getElementById('login-msg');
  const botao = document.querySelector('#tela-login button');
  msg.className = 'mensagem';
  msg.textContent = '';
  botao.disabled = true;
  botao.textContent = 'Entrando...';

  if (!email || !senha) {
    msg.textContent = 'Preencha e-mail e senha.';
    botao.disabled = false;
    botao.textContent = 'Entrar';
    return;
  }

  try {
    const res = await fetch(API + '/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha })
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      localStorage.setItem('token', data.token);
      msg.className = 'mensagem sucesso';
      msg.textContent = 'Login realizado! Redirecionando...';
      setTimeout(() => { window.location.href = '../dashboard/index.html'; }, 600);
    } else {
      msg.textContent = data.message || 'Erro ao fazer login.';
    }
  } catch {
    msg.textContent = 'Servidor offline.';
  } finally {
    botao.disabled = false;
    botao.textContent = 'Entrar';
  }
}

if (localStorage.getItem('token')) {
  window.location.href = '../dashboard/index.html';
}
