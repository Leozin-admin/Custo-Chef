/* =========================================================
   dashboard.js — lógica do dashboard.html
   ========================================================= */

const API = 'http://localhost:3000';
const token = localStorage.getItem('token');
let pratoSelecionadoId = null;
let ingredientesCache = [];
let pratosCache = [];

if (!token) window.location.href = 'index.html';

function mostrarCriarRestaurante() {
  const modal = document.getElementById('modal-restaurante');
  modal.style.display = 'flex';
}

function fecharModal() {
  document.getElementById('modal-restaurante').style.display = 'none';
}

async function init() {
  const res = await fetch(API + '/restaurante', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  const data = await res.json();

  if (!data || !data.id) {
    document.getElementById('tela-setup').style.display = 'block';
  } else {
    document.getElementById('tela-setup').style.display = 'none';
    document.getElementById('tela-dashboard').style.display = 'block';
    document.getElementById('nome-rest').textContent = data.nome;
    await carregarIngredientes();
    await carregarPratos();
  }
}

async function criarRestaurante() {
  const nome = document.getElementById('nome-restaurante').value.trim();
  const msg = document.getElementById('setup-msg');
  if (!nome) { msg.textContent = 'Digite o nome do restaurante.'; return; }

  const res = await fetch(API + '/restaurante', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ nome })
  });

  if (res.ok) { init(); } else { msg.textContent = 'Erro ao criar restaurante.'; }
}

async function carregarIngredientes() {
  const res = await fetch(API + '/ingredientes', { headers: { 'Authorization': 'Bearer ' + token } });
  ingredientesCache = await res.json();
  renderIngredientes();
  atualizarSelectFicha();
  atualizarResumo();
}

async function carregarPratos() {
  const res = await fetch(API + '/pratos', { headers: { 'Authorization': 'Bearer ' + token } });
  pratosCache = await res.json();
  renderPratos();
  atualizarResumo();
}

function renderIngredientes() {
  const tbody = document.getElementById('tabela-ingredientes');
  if (!ingredientesCache.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="mensagem-vazia">Nenhum ingrediente cadastrado</td></tr>';
    return;
  }
  tbody.innerHTML = ingredientesCache.map(i => `
    <tr>
      <td>${i.nome}</td>
      <td>${i.unidade}</td>
      <td>R$ ${parseFloat(i.precoPorUnidade).toFixed(2)}</td>
      <td><button class="btn-remover" onclick="removerIngrediente(${i.id})">✕</button></td>
    </tr>
  `).join('');
}

function renderPratos() {
  const tbody = document.getElementById('tabela-pratos');
  if (!pratosCache.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="mensagem-vazia">Nenhum prato cadastrado</td></tr>';
    return;
  }
  tbody.innerHTML = pratosCache.map(p => {
    const cmv = parseFloat(p.cmv || 0).toFixed(2);
    const margem = parseFloat(p.margem || 0).toFixed(1);
    let badge = '';
    if (p.margem >= 60) badge = '<span class="badge badge-verde">Ótima</span>';
    else if (p.margem >= 35) badge = '<span class="badge badge-amarelo">Regular</span>';
    else badge = '<span class="badge badge-vermelho">Baixa</span>';

    return `
      <tr>
        <td><a href="#" class="link-prato" onclick="abrirFicha(${p.id}, '${p.nome}')">${p.nome}</a></td>
        <td>R$ ${parseFloat(p.precoVenda).toFixed(2)}</td>
        <td>R$ ${cmv}</td>
        <td>${margem}%</td>
        <td>${badge}</td>
        <td><button class="btn-remover" onclick="removerPrato(${p.id})">✕</button></td>
      </tr>
    `;
  }).join('');
}

function atualizarResumo() {
  document.getElementById('res-pratos').textContent = pratosCache.length;
  document.getElementById('res-ingredientes').textContent = ingredientesCache.length;

  if (pratosCache.length) {
    const comFicha = pratosCache.filter(p => p.fichas && p.fichas.length > 0);
    if (comFicha.length) {
      const melhor = comFicha.reduce((a, b) => a.margem > b.margem ? a : b);
      const pior = comFicha.reduce((a, b) => a.margem < b.margem ? a : b);
      document.getElementById('res-melhor').textContent = melhor.nome;
      document.getElementById('res-pior').textContent = pior.nome;
    }
  }
}

function atualizarSelectFicha() {
  const select = document.getElementById('ficha-ingrediente');
  select.innerHTML = '<option value="">Selecione o ingrediente</option>';
  ingredientesCache.forEach(i => {
    select.innerHTML += `<option value="${i.id}">${i.nome} (${i.unidade})</option>`;
  });
}

async function adicionarIngrediente() {
  const nome = document.getElementById('ing-nome').value.trim();
  const unidade = document.getElementById('ing-unidade').value.trim();
  const precoPorUnidade = parseFloat(document.getElementById('ing-preco').value);

  if (!nome || !unidade || isNaN(precoPorUnidade)) { alert('Preencha todos os campos do ingrediente.'); return; }

  await fetch(API + '/ingredientes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ nome, unidade, precoPorUnidade })
  });

  document.getElementById('ing-nome').value = '';
  document.getElementById('ing-unidade').value = '';
  document.getElementById('ing-preco').value = '';
  await carregarIngredientes();
}

async function removerIngrediente(id) {
  if (!confirm('Remover ingrediente?')) return;
  await fetch(API + '/ingredientes/' + id, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } });
  await carregarIngredientes();
}

async function adicionarPrato() {
  const nome = document.getElementById('prato-nome').value.trim();
  const precoVenda = parseFloat(document.getElementById('prato-preco').value);

  if (!nome || isNaN(precoVenda)) { alert('Preencha nome e preço do prato.'); return; }

  await fetch(API + '/pratos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ nome, precoVenda })
  });

  document.getElementById('prato-nome').value = '';
  document.getElementById('prato-preco').value = '';
  await carregarPratos();
}

async function removerPrato(id) {
  if (!confirm('Remover prato e sua ficha técnica?')) return;
  await fetch(API + '/pratos/' + id, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } });
  await carregarPratos();
}

async function abrirFicha(pratoId, pratoNome) {
  pratoSelecionadoId = pratoId;
  document.getElementById('ficha-nome-prato').textContent = pratoNome;
  document.getElementById('secao-ficha').style.display = 'block';
  await carregarFicha();
}

function fecharFicha() {
  document.getElementById('secao-ficha').style.display = 'none';
  pratoSelecionadoId = null;
}

async function carregarFicha() {
  const res = await fetch(API + '/pratos/' + pratoSelecionadoId + '/ficha', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  const fichas = await res.json();
  const tbody = document.getElementById('tabela-ficha');

  if (!fichas.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="mensagem-vazia">Nenhum ingrediente na ficha</td></tr>';
    return;
  }

  tbody.innerHTML = fichas.map(f => {
    const custo = (f.quantidade * f.ingrediente.precoPorUnidade).toFixed(2);
    return `
      <tr>
        <td>${f.ingrediente.nome}</td>
        <td>${f.quantidade}</td>
        <td>${f.ingrediente.unidade}</td>
        <td>R$ ${custo}</td>
        <td><button class="btn-remover" onclick="removerFicha(${f.id})">✕</button></td>
      </tr>
    `;
  }).join('');
}

async function adicionarFicha() {
  const ingredienteId = parseInt(document.getElementById('ficha-ingrediente').value);
  const quantidade = parseFloat(document.getElementById('ficha-quantidade').value);

  if (!ingredienteId || isNaN(quantidade)) { alert('Selecione o ingrediente e a quantidade.'); return; }

  await fetch(API + '/pratos/' + pratoSelecionadoId + '/ficha', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ ingredienteId, quantidade })
  });

  document.getElementById('ficha-ingrediente').value = '';
  document.getElementById('ficha-quantidade').value = '';
  await carregarFicha();
  await carregarPratos();
}

async function removerFicha(id) {
  await fetch(API + '/ficha/' + id, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } });
  await carregarFicha();
  await carregarPratos();
}

function mudarAba(aba) {
  document.getElementById('aba-ingredientes').style.display = aba === 'ingredientes' ? 'block' : 'none';
  document.getElementById('aba-pratos').style.display = aba === 'pratos' ? 'block' : 'none';
  document.querySelectorAll('.aba').forEach((el, i) => {
    el.classList.toggle('ativa', (i === 0 && aba === 'ingredientes') || (i === 1 && aba === 'pratos'));
  });
}

function fazerLogout() {
  localStorage.removeItem('token');
  window.location.href = 'index.html';
}

init();
