/* =========================================================
   dashboard.js — lógica completa do dashboard
   ========================================================= */

const token = TokenStore.get();
let restaurante = null;
let ingredientesCache = [];
let pratosCache = [];
let fornecedoresCache = [];
let pratoSelecionadoId = null;

/* =========================================================
   TEMA CLARO/ESCURO
   ========================================================= */

function aplicarTema() {
  let temaSalvo = null;
  try {
    temaSalvo = localStorage.getItem('custochef-tema');
  } catch (e) {
    console.warn('Failed to read theme from localStorage:', e);
    temaSalvo = null;
  }
  const htmlElement = document.documentElement;
  const toggleBtn = document.getElementById('theme-toggle');

  if (temaSalvo === 'dark') {
    htmlElement.setAttribute('data-theme', 'dark');
    if (toggleBtn) toggleBtn.textContent = '🌙';
  } else {
    htmlElement.removeAttribute('data-theme');
    if (toggleBtn) toggleBtn.textContent = '☀️';
  }
}

function alternarTema() {
  const htmlElement = document.documentElement;
  const isDark = htmlElement.getAttribute('data-theme') === 'dark';
  const toggleBtn = document.getElementById('theme-toggle');

  if (isDark) {
    htmlElement.removeAttribute('data-theme');
    try {
      localStorage.removeItem('custochef-tema');
    } catch (e) {
      console.warn('Failed to remove theme from localStorage:', e);
    }
    if (toggleBtn) toggleBtn.textContent = '☀️';
  } else {
    htmlElement.setAttribute('data-theme', 'dark');
    try {
      localStorage.setItem('custochef-tema', 'dark');
    } catch (e) {
      console.warn('Failed to save theme to localStorage:', e);
    }
    if (toggleBtn) toggleBtn.textContent = '🌙';
  }
}

/* =========================================================
   INIT
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  if (window.MODO_DEMO) {
    iniciarModoDemo();
    return;
  }
  if (!token) {
    window.location.href = '../auth/index.html';
    return;
  }
  init();
  const params = new URLSearchParams(window.location.search);
  if (params.get('assinatura') === 'sucesso') {
    toast('Assinatura ativada! Bem-vindo ao plano pago 🎉', 'sucesso', 6000);
    window.history.replaceState({}, '', window.location.pathname);
  } else if (params.get('assinatura') === 'cancelada') {
    toast('Assinatura cancelada. Você continua no plano atual.', 'info');
    window.history.replaceState({}, '', window.location.pathname);
  }
});

function iniciarModoDemo() {
  restaurante = window.DEMO.restaurante;
  ingredientesCache = window.DEMO.ingredientes;
  pratosCache = window.DEMO.pratos;
  fornecedoresCache = window.DEMO.fornecedores;

  document.getElementById('tela-setup').style.display = 'none';
  document.getElementById('tela-dashboard').style.display = 'block';
  document.getElementById('nome-rest').textContent = restaurante.nome + ' (Demonstração)';

  renderIngredientes();
  atualizarSelectFicha();
  atualizarSelectFornecedor();
  atualizarSelectMov();
  renderPratos();
  renderFornecedores();

  // KPIs simplificados calculados a partir dos dados demo
  const $ = id => document.getElementById(id);
  $('kpi-ingredientes').textContent = ingredientesCache.length;
  $('kpi-pratos').textContent = pratosCache.length;
  $('kpi-pratos-ficha').textContent = pratosCache.filter(p => p.fichas?.length > 0).length;
  const margemMedia = pratosCache.reduce((acc, p) => acc + p.margem, 0) / pratosCache.length;
  $('kpi-margem-media').textContent = margemMedia.toFixed(1) + '%';
  const valorEstoque = ingredientesCache.reduce((acc, i) => acc + i.estoqueAtual * i.precoPorUnidade, 0);
  $('kpi-valor-estoque').textContent = 'R$ ' + valorEstoque.toFixed(2).replace('.', ',');
  $('kpi-estoque-baixo').textContent = ingredientesCache.filter(i => i.estoqueAtual <= i.estoqueMinimo).length;
  $('kpi-pratos-criticos').textContent = pratosCache.filter(p => p.margem < 35).length;
  $('kpi-pratos-otimos').textContent = pratosCache.filter(p => p.margem >= 60).length;

  const ordenados = [...pratosCache].sort((a, b) => b.margem - a.margem);
  $('res-melhor-prato').textContent = `${ordenados[0].nome} (${ordenados[0].margem.toFixed(1)}%)`;
  $('res-pior-prato').textContent = `${ordenados[ordenados.length - 1].nome} (${ordenados[ordenados.length - 1].margem.toFixed(1)}%)`;
  $('top5').innerHTML = ordenados.slice(0, 5).map(p => `<li><strong>${escapeHtml(p.nome)}</strong> — ${p.margem.toFixed(1)}%</li>`).join('');
  $('bottom5').innerHTML = [...ordenados].reverse().slice(0, 5).map(p => `<li><strong>${escapeHtml(p.nome)}</strong> — ${p.margem.toFixed(1)}%</li>`).join('');

  // Banner fixo avisando que é demo
  const aviso = document.createElement('div');
  aviso.style.cssText = 'position:fixed;bottom:16px;right:16px;background:var(--c-orange-bright);color:white;padding:12px 20px;border-radius:10px;font-weight:700;box-shadow:0 4px 20px rgba(0,0,0,0.3);z-index:3000;';
  aviso.innerHTML = '👀 Modo demonstração — <a href="../auth/index.html?tela=cadastro" style="color:white;text-decoration:underline;">Criar minha conta grátis</a>';
  document.body.appendChild(aviso);

  aplicarTema();
}

async function init() {
  const res = await fetchAuth(API + '/restaurante');
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) return; // api.js já redireciona
    toast('Erro ao carregar restaurante', 'erro');
    return;
  }
  const data = await res.json();

  if (!data || !data.id) {
    document.getElementById('tela-setup').style.display = 'block';
    return;
  }

  restaurante = data;
  document.getElementById('tela-setup').style.display = 'none';
  document.getElementById('tela-dashboard').style.display = 'block';
  document.getElementById('nome-rest').textContent = data.nome;
  // Preenche config
  ['nome', 'email', 'telefone', 'cnpj'].forEach(k => {
    const el = document.getElementById('cfg-' + k);
    if (el && data[k]) el.value = data[k];
  });
  const end = document.getElementById('cfg-endereco');
  if (end && data.endereco) end.value = data.endereco;
  const plano = document.getElementById('cfg-plano');
  if (plano) plano.textContent = (data.plano || 'free').toUpperCase();

  // Carrega perfil
  const perfil = await fetchAuth(API + '/auth/perfil');
  if (perfil.ok) {
    const p = await perfil.json();
    const pn = document.getElementById('perfil-nome'); if (pn) pn.value = p.nome || '';
    const pe = document.getElementById('perfil-email'); if (pe) pe.value = p.email || '';
  }

  await Promise.all([
    carregarIngredientes(),
    carregarPratos(),
    carregarFornecedores(),
    carregarAlertasContador()
  ]);
  await carregarVisaoGeral();

  // Inicializar tema
  aplicarTema();
  const toggleBtn = document.getElementById('theme-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', alternarTema);
  }

  // Tour automático para usuário novo (sem ingredientes e que nunca viu o tour)
  if (ingredientesCache.length === 0 && !localStorage.getItem('tourConcluido')) {
    setTimeout(iniciarTour, 600);
  }
}

/* =========================================================
   ABAS
   ========================================================= */

function abrirAba(nome) {
  document.querySelectorAll('.aba-painel').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.aba').forEach(b => b.classList.remove('ativa'));
  const painel = document.getElementById('aba-' + nome);
  const botao = document.querySelector(`.aba[data-aba="${nome}"]`);
  if (painel) painel.style.display = 'block';
  if (botao) botao.classList.add('ativa');

  // Carregamentos lazy por aba
  if (nome === 'visao-geral') carregarVisaoGeral();
  if (nome === 'ingredientes') carregarIngredientes();
  if (nome === 'pratos') carregarPratos();
  if (nome === 'fornecedores') carregarFornecedores();
  if (nome === 'estoque') carregarEstoque();
  if (nome === 'simulador') carregarSelectSimulador();
  if (nome === 'relatorios') carregarRelatorios();
  if (nome === 'equipe') carregarMembros();
  if (nome === 'alertas') carregarAlertas();
  if (nome === 'config') carregarConfig();
}

/* =========================================================
   VISÃO GERAL
   ========================================================= */

async function carregarVisaoGeral() {
  const res = await fetchAuth(API + '/dashboard/stats');
  if (!res.ok) return;
  const d = await res.json();
  const $ = id => document.getElementById(id);
  $('kpi-ingredientes').textContent = d.totais.ingredientes;
  $('kpi-pratos').textContent = d.totais.pratos;
  $('kpi-pratos-ficha').textContent = d.totais.pratosComFicha;
  $('kpi-margem-media').textContent = (d.margemMedia || 0).toFixed(1) + '%';
  $('kpi-valor-estoque').textContent = 'R$ ' + (d.totais.valorEstoque || 0).toFixed(2).replace('.', ',');
  $('kpi-estoque-baixo').textContent = d.totais.ingredientesBaixo;
  $('kpi-pratos-criticos').textContent = d.totais.pratosCriticos;
  $('kpi-pratos-otimos').textContent = d.totais.pratosOtimos;

  $('res-melhor-prato').textContent = d.pratoTop
    ? `${d.pratoTop.nome} (${(d.pratoTop.margem || 0).toFixed(1)}%)`
    : '—';
  $('res-pior-prato').textContent = d.piorPrato
    ? `${d.piorPrato.nome} (${(d.piorPrato.margem || 0).toFixed(1)}%)`
    : '—';

  $('top5').innerHTML = (d.top5 || []).map(p =>
    `<li><strong>${escapeHtml(p.nome)}</strong> — ${(p.margem || 0).toFixed(1)}%</li>`
  ).join('') || '<li class="mensagem-vazia">Sem dados ainda</li>';

  $('bottom5').innerHTML = (d.bottom5 || []).map(p =>
    `<li><strong>${escapeHtml(p.nome)}</strong> — ${(p.margem || 0).toFixed(1)}%</li>`
  ).join('') || '<li class="mensagem-vazia">Sem dados ainda</li>';
}

/* =========================================================
   SETUP (criação de restaurante)
   ========================================================= */

function mostrarCriarRestaurante() {
  const modal = document.getElementById('modal-restaurante');
  modal.style.display = 'flex';
  setTimeout(() => document.getElementById('nome-restaurante')?.focus(), 50);
}

function fecharModal() {
  document.getElementById('modal-restaurante').style.display = 'none';
}

async function criarRestaurante() {
  const input = document.getElementById('nome-restaurante');
  const nome = input.value.trim();
  const msg = document.getElementById('setup-msg');
  if (!nome) { msg.textContent = 'Digite o nome do restaurante.'; return; }
  msg.textContent = '';

  const res = await fetchAuth(API + '/restaurante', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome })
  });

  if (res.ok) {
    fecharModal();
    toast('Restaurante criado! 🎉', 'sucesso');
    init();
  } else {
    const data = await res.json().catch(() => ({}));
    msg.textContent = data.message || 'Erro ao criar restaurante.';
  }
}

/* =========================================================
   INGREDIENTES
   ========================================================= */

async function carregarIngredientes() {
  const res = await fetchAuth(API + '/ingredientes');
  if (!res.ok) return;
  ingredientesCache = await res.json();
  renderIngredientes();
  atualizarSelectFicha();
  atualizarSelectFornecedor();
  atualizarSelectMov();
}

function renderIngredientes() {
  const tbody = document.getElementById('tabela-ingredientes');
  if (!tbody) return;
  const filtro = (document.getElementById('filtro-ingrediente')?.value || '').toLowerCase();
  const lista = ingredientesCache.filter(i => !filtro || i.nome.toLowerCase().includes(filtro));
  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="mensagem-vazia">Nenhum ingrediente cadastrado</td></tr>';
    return;
  }
  tbody.innerHTML = lista.map(i => {
    const estoqueBaixo = i.estoqueMinimo > 0 && i.estoqueAtual <= i.estoqueMinimo;
    return `
      <tr>
        <td><strong>${escapeHtml(i.nome)}</strong></td>
        <td>${escapeHtml(i.unidade)}</td>
        <td>R$ ${parseFloat(i.precoPorUnidade).toFixed(2).replace('.', ',')}</td>
        <td class="${estoqueBaixo ? 'cell-baix' : ''}">${parseFloat(i.estoqueAtual).toFixed(2)} ${estoqueBaixo ? '⚠️' : ''}</td>
        <td>${parseFloat(i.estoqueMinimo).toFixed(2)}</td>
        <td>${escapeHtml(i.categoria || '—')}</td>
        <td>${escapeHtml(i.fornecedor?.nome || '—')}</td>
        <td class="acoes-tabela">
          <button class="btn-icon" onclick="verHistoricoPreco(${i.id}, '${escapeHtml(i.nome).replace(/'/g, "\\'")}')" title="Histórico de preços">📈</button>
          <button class="btn-icon" onclick="editarIngrediente(${i.id})" title="Editar">✏️</button>
          <button class="btn-icon btn-icon-danger" onclick="removerIngrediente(${i.id})" title="Remover">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
}

async function adicionarIngrediente() {
  const campos = [
    { name: 'nome', label: 'Nome', value: document.getElementById('ing-nome').value.trim(), required: true },
    { name: 'unidade', label: 'Unidade', value: document.getElementById('ing-unidade').value.trim(), required: true },
    { name: 'precoPorUnidade', label: 'Preço por unidade (R$)', value: parseFloat(document.getElementById('ing-preco').value), required: true, tipo: 'number' },
    { name: 'estoqueAtual', label: 'Estoque atual', value: parseFloat(document.getElementById('ing-estoque').value) || 0, tipo: 'number' },
    { name: 'estoqueMinimo', label: 'Estoque mínimo', value: parseFloat(document.getElementById('ing-estoque-min').value) || 0, tipo: 'number' },
    { name: 'categoria', label: 'Categoria (opcional)', value: document.getElementById('ing-categoria').value.trim() },
    {
      name: 'fornecedorId', label: 'Fornecedor', value: document.getElementById('ing-fornecedor').value, tipo: 'select',
      options: [{ value: '', label: 'Sem fornecedor' }].concat(fornecedoresCache.map(f => ({ value: f.id, label: f.nome })))
    }
  ];

  if (!campos[0].value || !campos[1].value || isNaN(campos[2].value)) {
    toast('Preencha nome, unidade e preço', 'erro');
    return;
  }
  const payload = {};
  campos.forEach(c => { if (c.value !== '' && c.value != null) payload[c.name] = c.value; });

  const btn = document.getElementById('btn-add-ingrediente');
  btn.disabled = true;
  const res = await fetchAuth(API + '/ingredientes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  btn.disabled = false;

  if (res.ok) {
    ['ing-nome', 'ing-unidade', 'ing-preco', 'ing-estoque', 'ing-estoque-min', 'ing-categoria', 'ing-fornecedor']
      .forEach(id => document.getElementById(id).value = '');
    toast('Ingrediente adicionado! 🥩', 'sucesso');
    await carregarIngredientes();
  } else {
    const d = await res.json().catch(() => ({}));
    toast(d.message || 'Erro ao adicionar', 'erro');
  }
}

async function removerIngrediente(id) {
  const ok = await showConfirm({
    titulo: 'Remover ingrediente?',
    mensagem: 'Essa ação não pode ser desfeita.'
  });
  if (!ok) return;
  const res = await fetchAuth(API + '/ingredientes/' + id, { method: 'DELETE' });
  if (res.ok) { toast('Removido', 'sucesso'); await carregarIngredientes(); }
  else { const d = await res.json().catch(() => ({})); toast(d.message || 'Erro', 'erro'); }
}

async function editarIngrediente(id) {
  const ing = ingredientesCache.find(i => i.id === id);
  if (!ing) return;
  const valores = await showForm({
    titulo: 'Editar ingrediente',
    campos: [
      { name: 'nome', label: 'Nome', default: ing.nome, required: true },
      { name: 'unidade', label: 'Unidade', default: ing.unidade, required: true },
      { name: 'precoPorUnidade', label: 'Preço por unidade (R$)', tipo: 'number', step: '0.01', default: ing.precoPorUnidade, required: true },
      { name: 'estoqueAtual', label: 'Estoque atual', tipo: 'number', step: '0.01', default: ing.estoqueAtual },
      { name: 'estoqueMinimo', label: 'Estoque mínimo', tipo: 'number', step: '0.01', default: ing.estoqueMinimo },
      { name: 'categoria', label: 'Categoria', default: ing.categoria || '' },
      {
        name: 'fornecedorId', label: 'Fornecedor', tipo: 'select',
        options: [{ value: '', label: 'Sem fornecedor' }].concat(fornecedoresCache.map(f => ({ value: f.id, label: f.nome }))),
        default: ing.fornecedorId || ''
      }
    ],
    textoConfirmar: 'Salvar'
  });
  if (!valores) return;
  const res = await fetchAuth(API + '/ingredientes/' + id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(valores)
  });
  if (res.ok) { toast('Atualizado!', 'sucesso'); await carregarIngredientes(); }
  else { const d = await res.json().catch(() => ({})); toast(d.message || 'Erro', 'erro'); }
}

async function verHistoricoPreco(id, nome) {
  ingredienteAtualHistorico = { id, nome };
  trocarAbaHistorico('historico');
  const res = await fetchAuth(API + '/ingredientes/' + id + '/historico-precos');
  if (!res.ok) return;
  const historico = await res.json();
  document.getElementById('hist-nome').textContent = nome;
  const html = historico.length
    ? `<table><thead><tr><th>Data</th><th>Preço anterior</th><th>Preço novo</th><th>Variação</th><th>Por</th></tr></thead><tbody>
       ${historico.map(h => {
      const variacao = ((h.precoNovo - h.precoAnterior) / h.precoAnterior * 100);
      const classe = variacao > 0 ? 'cell-baix' : variacao < 0 ? 'cell-good' : '';
      return `<tr><td>${new Date(h.dataAlteracao).toLocaleString('pt-BR')}</td>
           <td>R$ ${parseFloat(h.precoAnterior).toFixed(2).replace('.', ',')}</td>
           <td>R$ ${parseFloat(h.precoNovo).toFixed(2).replace('.', ',')}</td>
           <td class="${classe}">${variacao > 0 ? '+' : ''}${variacao.toFixed(1)}%</td>
           <td>${escapeHtml(h.usuario?.nome || '—')}</td></tr>`;
    }).join('')}</tbody></table>`
    : '<p class="mensagem-vazia">Nenhuma alteração registrada</p>';
  document.getElementById('hist-tabela').innerHTML = html;
  document.getElementById('modal-historico').style.display = 'block';
}

function atualizarSelectFornecedor() {
  const sel = document.getElementById('ing-fornecedor');
  if (!sel) return;
  sel.innerHTML = '<option value="">Sem fornecedor</option>' +
    fornecedoresCache.map(f => `<option value="${f.id}">${escapeHtml(f.nome)}</option>`).join('');
}

/* =========================================================
   PRATOS
   ========================================================= */

async function carregarPratos() {
  const res = await fetchAuth(API + '/pratos');
  if (!res.ok) return;
  pratosCache = await res.json();
  renderPratos();
}

function renderPratos() {
  const tbody = document.getElementById('tabela-pratos');
  if (!tbody) return;
  const filtro = (document.getElementById('filtro-prato')?.value || '').toLowerCase();
  const lista = pratosCache.filter(p => !filtro || p.nome.toLowerCase().includes(filtro));
  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="mensagem-vazia">Nenhum prato cadastrado</td></tr>';
    return;
  }
  tbody.innerHTML = lista.map(p => {
    const cmv = parseFloat(p.cmv || 0);
    const margem = parseFloat(p.margem || 0);
    let badge = '';
    if (margem >= 60) badge = '<span class="badge badge-verde">Ótima</span>';
    else if (margem >= 35) badge = '<span class="badge badge-amarelo">Regular</span>';
    else badge = '<span class="badge badge-vermelho">Baixa</span>';
    return `
      <tr>
        <td><a href="#" class="link-prato" onclick="abrirFicha(${p.id}, '${escapeHtml(p.nome).replace(/'/g, "\\'")}'); return false;">${escapeHtml(p.nome)}</a></td>
        <td>${escapeHtml(p.categoria || '—')}</td>
        <td>R$ ${parseFloat(p.precoVenda).toFixed(2).replace('.', ',')}</td>
        <td>R$ ${cmv.toFixed(2).replace('.', ',')}</td>
        <td>${margem.toFixed(1)}%</td>
        <td>${badge}</td>
        <td class="acoes-tabela">
          <button class="btn-icon" onclick="abrirFicha(${p.id}, '${escapeHtml(p.nome).replace(/'/g, "\\'")}')" title="Ficha técnica">📋</button>
          <button class="btn-icon" onclick="editarPrato(${p.id})" title="Editar">✏️</button>
          <button class="btn-icon btn-icon-danger" onclick="removerPrato(${p.id})" title="Remover">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
}

async function adicionarPrato() {
  const nome = document.getElementById('prato-nome').value.trim();
  const precoVenda = parseFloat(document.getElementById('prato-preco').value);
  if (!nome || isNaN(precoVenda)) { toast('Preencha nome e preço', 'erro'); return; }
  const payload = {
    nome,
    precoVenda,
    categoria: document.getElementById('prato-categoria').value.trim() || null,
    tempoPreparo: parseInt(document.getElementById('prato-tempo').value) || null,
    rendimento: parseInt(document.getElementById('prato-rendimento').value) || 1,
    descricao: document.getElementById('prato-descricao').value.trim() || null
  };
  const btn = document.getElementById('btn-add-prato');
  btn.disabled = true;
  const res = await fetchAuth(API + '/pratos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  btn.disabled = false;
  if (res.ok) {
    ['prato-nome', 'prato-preco', 'prato-categoria', 'prato-tempo', 'prato-rendimento', 'prato-descricao']
      .forEach(id => document.getElementById(id).value = '');
    document.getElementById('prato-rendimento').value = 1;
    toast('Prato adicionado! 📋', 'sucesso');
    await carregarPratos();
    carregarVisaoGeral();
  } else {
    const d = await res.json().catch(() => ({}));
    toast(d.message || 'Erro', 'erro');
  }
}

async function removerPrato(id) {
  const ok = await showConfirm({
    titulo: 'Remover prato?',
    mensagem: 'A ficha técnica também será removida.'
  });
  if (!ok) return;
  const res = await fetchAuth(API + '/pratos/' + id, { method: 'DELETE' });
  if (res.ok) { toast('Removido', 'sucesso'); await carregarPratos(); carregarVisaoGeral(); }
  else { const d = await res.json().catch(() => ({})); toast(d.message || 'Erro', 'erro'); }
}

async function editarPrato(id) {
  const p = pratosCache.find(x => x.id === id);
  if (!p) return;
  const valores = await showForm({
    titulo: 'Editar prato',
    campos: [
      { name: 'nome', label: 'Nome', default: p.nome, required: true },
      { name: 'precoVenda', label: 'Preço de venda (R$)', tipo: 'number', step: '0.01', default: p.precoVenda, required: true },
      { name: 'categoria', label: 'Categoria', default: p.categoria || '' },
      { name: 'tempoPreparo', label: 'Tempo de preparo (min)', tipo: 'number', default: p.tempoPreparo || '' },
      { name: 'rendimento', label: 'Rendimento', tipo: 'number', min: '1', default: p.rendimento || 1 },
      { name: 'descricao', label: 'Descrição', tipo: 'textarea', default: p.descricao || '' }
    ],
    textoConfirmar: 'Salvar'
  });
  if (!valores) return;
  const res = await fetchAuth(API + '/pratos/' + id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(valores)
  });
  if (res.ok) { toast('Atualizado!', 'sucesso'); await carregarPratos(); carregarVisaoGeral(); }
  else { const d = await res.json().catch(() => ({})); toast(d.message || 'Erro', 'erro'); }
}

/* =========================================================
   FICHA TÉCNICA
   ========================================================= */

async function abrirFicha(pratoId, pratoNome) {
  pratoSelecionadoId = pratoId;
  document.getElementById('ficha-nome-prato').textContent = pratoNome;
  document.getElementById('secao-ficha').style.display = 'block';
  await carregarFicha();
  setTimeout(() => document.getElementById('secao-ficha').scrollIntoView({ behavior: 'smooth' }), 50);
}

function fecharFicha() {
  document.getElementById('secao-ficha').style.display = 'none';
  pratoSelecionadoId = null;
}

async function carregarFicha() {
  if (!pratoSelecionadoId) return;
  const res = await fetchAuth(API + '/pratos/' + pratoSelecionadoId + '/ficha');
  if (!res.ok) return;
  const fichas = await res.json();
  const tbody = document.getElementById('tabela-ficha');
  if (!fichas.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="mensagem-vazia">Nenhum ingrediente na ficha</td></tr>';
    document.getElementById('ficha-cmv-total').textContent = 'R$ 0,00';
    return;
  }
  let cmv = 0;
  tbody.innerHTML = fichas.map(f => {
    const custo = f.quantidade * f.ingrediente.precoPorUnidade;
    cmv += custo;
    return `
      <tr>
        <td>${escapeHtml(f.ingrediente.nome)}</td>
        <td>${parseFloat(f.quantidade).toFixed(2)}</td>
        <td>${escapeHtml(f.ingrediente.unidade)}</td>
        <td>R$ ${parseFloat(f.ingrediente.precoPorUnidade).toFixed(2).replace('.', ',')}</td>
        <td>R$ ${custo.toFixed(2).replace('.', ',')}</td>
        <td><button class="btn-icon btn-icon-danger" onclick="removerFicha(${f.id})">🗑️</button></td>
      </tr>
    `;
  }).join('');
  document.getElementById('ficha-cmv-total').textContent = 'R$ ' + cmv.toFixed(2).replace('.', ',');
}

function atualizarSelectFicha() {
  const sel = document.getElementById('ficha-ingrediente');
  if (!sel) return;
  sel.innerHTML = '<option value="">Selecione o ingrediente</option>' +
    ingredientesCache.map(i => `<option value="${i.id}">${escapeHtml(i.nome)} (${escapeHtml(i.unidade)})</option>`).join('');
}

async function adicionarFicha() {
  const ingredienteId = parseInt(document.getElementById('ficha-ingrediente').value);
  const quantidade = parseFloat(document.getElementById('ficha-quantidade').value);
  if (!ingredienteId || isNaN(quantidade)) { toast('Selecione ingrediente e quantidade', 'erro'); return; }
  const res = await fetchAuth(API + '/pratos/' + pratoSelecionadoId + '/ficha', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ingredienteId, quantidade })
  });
  if (res.ok) {
    document.getElementById('ficha-ingrediente').value = '';
    document.getElementById('ficha-quantidade').value = '';
    await carregarFicha();
    await carregarPratos();
    carregarVisaoGeral();
    toast('Adicionado à ficha!', 'sucesso');
  } else {
    const d = await res.json().catch(() => ({}));
    toast(d.message || 'Erro', 'erro');
  }
}

async function removerFicha(id) {
  const ok = await showConfirm({
    titulo: 'Remover item da ficha?',
    mensagem: 'Este item será removido da ficha técnica do prato.'
  });
  if (!ok) return;
  const res = await fetchAuth(API + '/pratos/ficha/' + id, { method: 'DELETE' });
  if (res.ok) { toast('Removido', 'sucesso'); await carregarFicha(); await carregarPratos(); carregarVisaoGeral(); }
  else { const d = await res.json().catch(() => ({})); toast(d.message || 'Erro', 'erro'); }
}

function exportarFichaTecnicaPDF() {
  if (!pratoSelecionadoId) return;
  const url = API + '/relatorios/ficha-tecnica/' + pratoSelecionadoId;
  baixarArquivo(url, 'ficha-tecnica.pdf');
}

/* =========================================================
   FORNECEDORES
   ========================================================= */

async function carregarFornecedores() {
  const res = await fetchAuth(API + '/fornecedores');
  if (!res.ok) return;
  fornecedoresCache = await res.json();
  renderFornecedores();
  atualizarSelectFornecedor();
}

function renderFornecedores() {
  const tbody = document.getElementById('tabela-fornecedores');
  if (!tbody) return;
  const filtro = (document.getElementById('filtro-forn')?.value || '').toLowerCase();
  const lista = fornecedoresCache.filter(f => !filtro || f.nome.toLowerCase().includes(filtro));
  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="mensagem-vazia">Nenhum fornecedor cadastrado</td></tr>';
    return;
  }
  tbody.innerHTML = lista.map(f => `
    <tr>
      <td><strong>${escapeHtml(f.nome)}</strong></td>
      <td>${escapeHtml(f.contato || '—')}</td>
      <td>${escapeHtml(f.telefone || '—')}</td>
      <td>${escapeHtml(f.email || '—')}</td>
      <td>${f.ingredientes?.length || 0}</td>
      <td class="acoes-tabela">
        <button class="btn-icon" onclick="editarFornecedor(${f.id})" title="Editar">✏️</button>
        <button class="btn-icon btn-icon-danger" onclick="removerFornecedor(${f.id})" title="Remover">🗑️</button>
      </td>
    </tr>
  `).join('');
}

async function adicionarFornecedor() {
  const payload = {
    nome: document.getElementById('forn-nome').value.trim(),
    contato: document.getElementById('forn-contato').value.trim() || null,
    telefone: document.getElementById('forn-telefone').value.trim() || null,
    email: document.getElementById('forn-email').value.trim() || null,
    observacoes: document.getElementById('forn-obs').value.trim() || null
  };
  if (!payload.nome) { toast('Nome é obrigatório', 'erro'); return; }
  const btn = document.getElementById('btn-add-forn');
  btn.disabled = true;
  const res = await fetchAuth(API + '/fornecedores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  btn.disabled = false;
  if (res.ok) {
    ['forn-nome', 'forn-contato', 'forn-telefone', 'forn-email', 'forn-obs'].forEach(id => document.getElementById(id).value = '');
    toast('Fornecedor adicionado! 🏪', 'sucesso');
    await carregarFornecedores();
  } else {
    const d = await res.json().catch(() => ({}));
    toast(d.message || 'Erro', 'erro');
  }
}

async function editarFornecedor(id) {
  const f = fornecedoresCache.find(x => x.id === id);
  if (!f) return;
  const valores = await showForm({
    titulo: 'Editar fornecedor',
    campos: [
      { name: 'nome', label: 'Nome', default: f.nome, required: true },
      { name: 'contato', label: 'Contato', default: f.contato || '' },
      { name: 'telefone', label: 'Telefone', default: f.telefone || '' },
      { name: 'email', label: 'Email', tipo: 'email', default: f.email || '' },
      { name: 'observacoes', label: 'Observações', tipo: 'textarea', default: f.observacoes || '' }
    ],
    textoConfirmar: 'Salvar'
  });
  if (!valores) return;
  const res = await fetchAuth(API + '/fornecedores/' + id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(valores)
  });
  if (res.ok) { toast('Atualizado!', 'sucesso'); await carregarFornecedores(); }
  else { const d = await res.json().catch(() => ({})); toast(d.message || 'Erro', 'erro'); }
}

async function removerFornecedor(id) {
  const ok = await showConfirm({ titulo: 'Remover fornecedor?', mensagem: 'Os ingredientes vinculados deixarão de ter fornecedor.' });
  if (!ok) return;
  const res = await fetchAuth(API + '/fornecedores/' + id, { method: 'DELETE' });
  if (res.ok) { toast('Removido', 'sucesso'); await carregarFornecedores(); }
  else { const d = await res.json().catch(() => ({})); toast(d.message || 'Erro', 'erro'); }
}

/* =========================================================
   ESTOQUE
   ========================================================= */

async function carregarEstoque() {
  await Promise.all([carregarMovimentacoes(), carregarEstoqueBaixo()]);
}

async function carregarMovimentacoes() {
  const res = await fetchAuth(API + '/estoque/movimentacoes');
  if (!res.ok) return;
  const movs = await res.json();
  const tbody = document.getElementById('tabela-movs');
  if (!tbody) return;
  if (!movs.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="mensagem-vazia">Nenhuma movimentação registrada</td></tr>';
    document.getElementById('estoque-movs-count').textContent = '0';
    return;
  }
  tbody.innerHTML = movs.slice(0, 50).map(m => `
    <tr>
      <td>${new Date(m.data).toLocaleString('pt-BR')}</td>
      <td>${escapeHtml(m.ingrediente.nome)}</td>
      <td><span class="badge ${m.tipo === 'entrada' ? 'badge-verde' : m.tipo === 'saida' ? 'badge-vermelho' : 'badge-amarelo'}">${m.tipo}</span></td>
      <td>${parseFloat(m.quantidade).toFixed(2)} ${escapeHtml(m.ingrediente.unidade)}</td>
      <td>${m.custoUnitario ? 'R$ ' + parseFloat(m.custoUnitario).toFixed(2).replace('.', ',') : '—'}</td>
      <td>${escapeHtml(m.observacao || '—')}</td>
    </tr>
  `).join('');
  document.getElementById('estoque-movs-count').textContent = movs.length;
}

async function carregarEstoqueBaixo() {
  const res = await fetchAuth(API + '/estoque/baixo');
  if (!res.ok) return;
  const baixos = await res.json();
  const lista = document.getElementById('lista-estoque-baixo');
  document.getElementById('estoque-baixo-count').textContent = baixos.length;
  if (!baixos.length) {
    lista.innerHTML = '<li class="mensagem-vazia">Nenhum item com estoque baixo 🎉</li>';
  } else {
    lista.innerHTML = baixos.map(i => `
      <li class="item-alerta">
        <strong>${escapeHtml(i.nome)}</strong> —
        ${parseFloat(i.estoqueAtual).toFixed(2)} ${escapeHtml(i.unidade)}
        (mín: ${parseFloat(i.estoqueMinimo).toFixed(2)})
        <button class="btn-mini" onclick="reporEstoque(${i.id}, '${escapeHtml(i.nome).replace(/'/g, "\\'")}')">Repor</button>
      </li>
    `).join('');
  }
  // Valor total
  const total = ingredientesCache.reduce((acc, i) => acc + (i.estoqueAtual * i.precoPorUnidade), 0);
  const elVal = document.getElementById('estoque-valor-total');
  if (elVal) elVal.textContent = 'R$ ' + total.toFixed(2).replace('.', ',');
}

function atualizarSelectMov() {
  const sel = document.getElementById('mov-ingrediente');
  if (!sel) return;
  sel.innerHTML = '<option value="">Selecione o ingrediente</option>' +
    ingredientesCache.map(i => `<option value="${i.id}">${escapeHtml(i.nome)} (${escapeHtml(i.unidade)})</option>`).join('');
}

async function registrarMovimentacao() {
  const ingredienteId = parseInt(document.getElementById('mov-ingrediente').value);
  const tipo = document.getElementById('mov-tipo').value;
  const quantidade = parseFloat(document.getElementById('mov-quantidade').value);
  const custoUnitario = parseFloat(document.getElementById('mov-custo').value) || null;
  const observacao = document.getElementById('mov-obs').value.trim() || null;

  if (!ingredienteId || isNaN(quantidade)) { toast('Selecione ingrediente e quantidade', 'erro'); return; }
  const res = await fetchAuth(API + '/estoque/movimentacoes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ingredienteId, tipo, quantidade, custoUnitario, observacao })
  });
  if (res.ok) {
    document.getElementById('mov-quantidade').value = '';
    document.getElementById('mov-custo').value = '';
    document.getElementById('mov-obs').value = '';
    toast('Movimentação registrada! 📦', 'sucesso');
    await carregarIngredientes();
    await carregarMovimentacoes();
    await carregarEstoqueBaixo();
    await carregarAlertasContador();
  } else {
    const d = await res.json().catch(() => ({}));
    toast(d.message || 'Erro', 'erro');
  }
}

async function reporEstoque(id, nome) {
  const qtd = await showPrompt({
    titulo: `Repor estoque de ${nome}`,
    label: 'Quantidade a adicionar',
    tipo: 'number',
    placeholder: 'Ex: 10',
    textoConfirmar: 'Adicionar'
  });
  if (!qtd || isNaN(parseFloat(qtd))) return;
  const res = await fetchAuth(API + '/estoque/movimentacoes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ingredienteId: id, tipo: 'entrada', quantidade: parseFloat(qtd), observacao: 'Reposição' })
  });
  if (res.ok) {
    toast('Estoque reposto!', 'sucesso');
    await carregarIngredientes();
    await carregarEstoque();
  } else {
    const d = await res.json().catch(() => ({}));
    toast(d.message || 'Erro', 'erro');
  }
}

/* =========================================================
   SIMULADOR
   ========================================================= */

function carregarSelectSimulador() {
  const sel = document.getElementById('sim-prato');
  if (!sel) return;
  sel.innerHTML = '<option value="">Selecione um prato</option>' +
    pratosCache.map(p => `<option value="${p.id}">${escapeHtml(p.nome)} (CMV: R$ ${parseFloat(p.cmv || 0).toFixed(2).replace('.', ',')})</option>`).join('');
}

async function carregarFichasSimulador() {
  document.getElementById('simulador-resultado').style.display = 'none';
}

async function simularPreco() {
  const pratoId = document.getElementById('sim-prato').value;
  const margemDesejada = parseFloat(document.getElementById('sim-margem').value);
  if (!pratoId) { toast('Selecione um prato', 'erro'); return; }
  if (isNaN(margemDesejada) || margemDesejada <= 0 || margemDesejada >= 100) {
    toast('Margem deve estar entre 0 e 100', 'erro'); return;
  }
  const res = await fetchAuth(API + '/simulador/preco', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pratoId: parseInt(pratoId), margemDesejada })
  });
  if (!res.ok) { const d = await res.json().catch(() => ({})); toast(d.message || 'Erro', 'erro'); return; }
  const data = await res.json();
  document.getElementById('simulador-resultado').style.display = 'block';
  document.getElementById('sim-prato-nome').textContent = data.pratoNome || '—';
  document.getElementById('sim-cmv').textContent = 'R$ ' + parseFloat(data.cmv || 0).toFixed(2).replace('.', ',');
  document.getElementById('sim-preco-sugerido').textContent = 'R$ ' + parseFloat(data.precoSugerido || 0).toFixed(2).replace('.', ',');
  document.getElementById('sim-lucro').textContent = 'Lucro estimado: R$ ' + parseFloat(data.lucroEstimado || 0).toFixed(2).replace('.', ',');

  document.getElementById('tabela-sensibilidade').innerHTML = (data.sensibilidade || []).map(s => `
    <tr>
      <td>${s.variacao > 0 ? '+' : ''}${s.variacao}%</td>
      <td>R$ ${parseFloat(s.preco).toFixed(2).replace('.', ',')}</td>
      <td>R$ ${parseFloat(s.lucro).toFixed(2).replace('.', ',')}</td>
      <td>${parseFloat(s.margem).toFixed(1)}%</td>
    </tr>
  `).join('');

  document.getElementById('tabela-fichas-sim').innerHTML = (data.fichas || []).map(f => `
    <tr>
      <td>${escapeHtml(f.ingrediente)}</td>
      <td>${parseFloat(f.quantidade).toFixed(2)}</td>
      <td>${escapeHtml(f.unidade)}</td>
      <td>R$ ${parseFloat(f.custo).toFixed(2).replace('.', ',')}</td>
    </tr>
  `).join('');
}

/* =========================================================
   RELATÓRIOS
   ========================================================= */

function carregarRelatorios() {
  const ul = document.getElementById('lista-fichas-pdf');
  if (!ul) return;
  if (!pratosCache.length) {
    ul.innerHTML = '<li class="mensagem-vazia">Cadastre pratos para baixar fichas técnicas.</li>';
    return;
  }
  ul.innerHTML = pratosCache.map(p => `
    <li class="item-relatorio">
      <span><strong>${escapeHtml(p.nome)}</strong> — CMV: R$ ${parseFloat(p.cmv || 0).toFixed(2).replace('.', ',')}</span>
      <button class="btn-laranja btn-mini" onclick="baixarFichaTecnica(${p.id})">📄 PDF</button>
    </li>
  `).join('');
}

function baixarFichaTecnica(id) {
  baixarArquivo(API + '/relatorios/ficha-tecnica/' + id, `ficha-${id}.pdf`);
}

function exportarCardapioPDF() {
  baixarArquivo(API + '/relatorios/cardapio', 'cardapio.pdf');
}

function exportarDados(formato) {
  baixarArquivo(API + '/relatorios/exportar?formato=' + formato, 'relatorio.' + (formato === 'csv' ? 'csv' : 'xls'));
}

function baixarArquivo(url, nome) {
  fetchAuth(url, { headers: { 'Authorization': 'Bearer ' + token } })
    .then(async res => {
      if (!res.ok) { toast('Erro ao baixar', 'erro'); return; }
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = nome;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
      toast('Download iniciado!', 'sucesso');
    })
    .catch(() => toast('Erro de conexão', 'erro'));
}

/* =========================================================
   EQUIPE
   ========================================================= */

async function carregarMembros() {
  const res = await fetchAuth(API + '/membros');
  if (!res.ok) return;
  const membros = await res.json();
  const tbody = document.getElementById('tabela-membros');
  if (!tbody) return;
  if (!membros.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="mensagem-vazia">Nenhum membro cadastrado</td></tr>';
    return;
  }
  tbody.innerHTML = membros.map(m => `
    <tr>
      <td><strong>${escapeHtml(m.usuario.nome)}</strong></td>
      <td>${escapeHtml(m.usuario.email)}</td>
      <td><span class="badge ${m.papel === 'dono' ? 'badge-amarelo' : m.papel === 'gerente' ? 'badge-verde' : 'badge-cinza'}">${m.papel}</span></td>
      <td>${new Date(m.criadoEm).toLocaleDateString('pt-BR')}</td>
      <td class="acoes-tabela">
        ${m.papel !== 'dono' ? `
          <button class="btn-icon" onclick="alterarPapelMembro(${m.id}, '${m.papel}')" title="Alterar papel">✏️</button>
          <button class="btn-icon btn-icon-danger" onclick="removerMembro(${m.id})" title="Remover">🗑️</button>
        ` : '<span class="badge badge-amarelo">dono</span>'}
      </td>
    </tr>
  `).join('');
}

async function convidarMembro() {
  const email = document.getElementById('mem-email').value.trim();
  const papel = document.getElementById('mem-papel').value;
  if (!email) { toast('Email obrigatório', 'erro'); return; }
  const res = await fetchAuth(API + '/membros/convidar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, papel })
  });
  if (res.ok) {
    document.getElementById('mem-email').value = '';
    toast(`Convite enviado para ${email}! 📧 (verifique o console do servidor)`, 'sucesso', 5000);
    await carregarMembros();
  } else {
    const d = await res.json().catch(() => ({}));
    toast(d.message || 'Erro', 'erro');
  }
}

async function alterarPapelMembro(id, papelAtual) {
  const novo = await showForm({
    titulo: 'Alterar papel',
    campos: [{
      name: 'papel', label: 'Papel', tipo: 'select',
      options: [
        { value: 'gerente', label: 'Gerente' },
        { value: 'funcionario', label: 'Funcionário' }
      ],
      default: papelAtual
    }],
    textoConfirmar: 'Salvar'
  });
  if (!novo) return;
  const res = await fetchAuth(API + '/membros/' + id, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(novo)
  });
  if (res.ok) { toast('Papel atualizado!', 'sucesso'); await carregarMembros(); }
  else { const d = await res.json().catch(() => ({})); toast(d.message || 'Erro', 'erro'); }
}

async function removerMembro(id) {
  const ok = await showConfirm({ titulo: 'Remover membro?', mensagem: 'O usuário deixará de ter acesso ao restaurante.' });
  if (!ok) return;
  const res = await fetchAuth(API + '/membros/' + id, { method: 'DELETE' });
  if (res.ok) { toast('Removido', 'sucesso'); await carregarMembros(); }
  else { const d = await res.json().catch(() => ({})); toast(d.message || 'Erro', 'erro'); }
}

/* =========================================================
   ALERTAS
   ========================================================= */

async function carregarAlertasContador() {
  const res = await fetchAuth(API + '/dashboard');
  if (!res.ok) return;
  const alertas = await res.json();
  const naoLidos = (alertas || []).filter(a => !a.lida).length;
  const badge = document.getElementById('badge-alertas');
  if (badge) {
    badge.textContent = naoLidos;
    badge.style.display = naoLidos > 0 ? 'inline-block' : 'none';
  }
}

async function carregarAlertas() {
  const res = await fetchAuth(API + '/dashboard');
  if (!res.ok) return;
  const alertas = await res.json();
  const div = document.getElementById('lista-alertas');
  if (!div) return;
  if (!alertas.length) {
    div.innerHTML = '<p class="mensagem-vazia">Nenhum alerta no momento 🎉</p>';
    return;
  }
  div.innerHTML = alertas.map(a => `
    <div class="alerta-item ${a.lida ? 'lida' : ''}">
      <div>
        <p class="alerta-msg">${escapeHtml(a.mensagem)}</p>
        <p class="alerta-data">${new Date(a.criadaEm).toLocaleString('pt-BR')}</p>
      </div>
      <div class="alertas-acoes">
        ${!a.lida ? `<button class="btn-mini" onclick="marcarAlertaLida(${a.id})">Marcar lida</button>` : ''}
        <button class="btn-icon btn-icon-danger" onclick="deletarAlerta(${a.id})">🗑️</button>
      </div>
    </div>
  `).join('');
}

async function marcarAlertaLida(id) {
  await fetchAuth(API + '/dashboard/' + id + '/lida', { method: 'PATCH' });
  await carregarAlertas();
  await carregarAlertasContador();
}

async function marcarTodasAlertas() {
  const res = await fetchAuth(API + '/dashboard/marcar-todas', { method: 'POST' });
  if (res.ok) { toast('Todas marcadas como lidas', 'sucesso'); await carregarAlertas(); await carregarAlertasContador(); }
}

async function deletarAlerta(id) {
  await fetchAuth(API + '/dashboard/' + id, { method: 'DELETE' });
  await carregarAlertas();
  await carregarAlertasContador();
}

/* =========================================================
   CONFIGURAÇÕES
   ========================================================= */

function carregarConfig() {
  if (!restaurante) return;
  ['nome', 'email', 'telefone', 'cnpj'].forEach(k => {
    const el = document.getElementById('cfg-' + k);
    if (el) el.value = restaurante[k] || '';
  });
  const end = document.getElementById('cfg-endereco');
  if (end) end.value = restaurante.endereco || '';

  const planoEl = document.getElementById('cfg-plano');
  if (planoEl) planoEl.textContent = (restaurante.plano || 'free').toUpperCase();

  const btnGerenciar = document.getElementById('btn-gerenciar-assinatura');
  if (btnGerenciar) {
    btnGerenciar.style.display = (restaurante.plano && restaurante.plano !== 'free') ? 'inline-block' : 'none';
  }

  const cbAtivo = document.getElementById('cfg-relatorio-ativo');
  if (cbAtivo) cbAtivo.checked = !!restaurante.relatorioEmailAtivo;
  const selFreq = document.getElementById('cfg-relatorio-frequencia');
  if (selFreq) selFreq.value = restaurante.relatorioFrequencia || 'semanal';
}

async function salvarConfigRestaurante() {
  const payload = {
    nome: document.getElementById('cfg-nome').value.trim(),
    email: document.getElementById('cfg-email').value.trim() || null,
    telefone: document.getElementById('cfg-telefone').value.trim() || null,
    cnpj: document.getElementById('cfg-cnpj').value.trim() || null,
    endereco: document.getElementById('cfg-endereco').value.trim() || null
  };
  if (!payload.nome) { toast('Nome é obrigatório', 'erro'); return; }
  const res = await fetchAuth(API + '/restaurante', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (res.ok) {
    const r = await res.json();
    restaurante = r;
    document.getElementById('nome-rest').textContent = r.nome;
    toast('Configurações salvas!', 'sucesso');
  } else {
    const d = await res.json().catch(() => ({}));
    toast(d.message || 'Erro', 'erro');
  }
}

async function salvarPreferenciaRelatorio() {
  const ativo = document.getElementById('cfg-relatorio-ativo').checked;
  const frequencia = document.getElementById('cfg-relatorio-frequencia').value;

  const res = await fetchAuth(API + '/restaurante/relatorio-email', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ativo, frequencia })
  });

  if (res.ok) {
    const r = await res.json();
    restaurante = r;
    toast('Preferência salva! 📧', 'sucesso');
  } else {
    const d = await res.json().catch(() => ({}));
    toast(d.message || 'Erro ao salvar', 'erro');
  }
}

async function salvarPerfil() {
  const payload = {
    nome: document.getElementById('perfil-nome').value.trim(),
    email: document.getElementById('perfil-email').value.trim(),
    senhaAtual: document.getElementById('perfil-senha-atual').value,
    novaSenha: document.getElementById('perfil-nova-senha').value || undefined
  };
  if (payload.novaSenha && !payload.senhaAtual) {
    toast('Digite a senha atual para alterar a senha', 'erro'); return;
  }
  const res = await fetchAuth(API + '/auth/perfil', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (res.ok) {
    document.getElementById('perfil-senha-atual').value = '';
    document.getElementById('perfil-nova-senha').value = '';
    toast('Perfil atualizado!', 'sucesso');
  } else {
    const d = await res.json().catch(() => ({}));
    toast(d.message || 'Erro', 'erro');
  }
}

let ingredienteAtualHistorico = null;

function trocarAbaHistorico(aba) {
  document.getElementById('tab-historico').classList.toggle('ativa', aba === 'historico');
  document.getElementById('tab-fornecedores').classList.toggle('ativa', aba === 'fornecedores');
  document.getElementById('painel-historico').style.display = aba === 'historico' ? 'block' : 'none';
  document.getElementById('painel-fornecedores').style.display = aba === 'fornecedores' ? 'block' : 'none';

  if (aba === 'fornecedores' && ingredienteAtualHistorico) {
    renderFormComparacao();
    carregarComparacaoFornecedores();
  }
}

function renderFormComparacao() {
  const form = document.getElementById('comp-form');
  form.innerHTML = `
    <select id="comp-fornecedor">
      <option value="">Selecione o fornecedor</option>
      ${fornecedoresCache.map(f => `<option value="${f.id}">${escapeHtml(f.nome)}</option>`).join('')}
    </select>
    <input type="number" step="0.01" id="comp-preco" placeholder="Preço (R$)">
    <button type="button" onclick="salvarPrecoFornecedor()">Adicionar</button>
  `;
}

async function carregarComparacaoFornecedores() {
  const res = await fetchAuth(API + '/ingrediente-fornecedor/' + ingredienteAtualHistorico.id);
  if (!res.ok) return;
  const precos = await res.json();

  const tabela = document.getElementById('comp-tabela');
  if (!precos.length) {
    tabela.innerHTML = '<p class="mensagem-vazia">Nenhum fornecedor cadastrado para este ingrediente ainda</p>';
    return;
  }

  const menorPreco = Math.min(...precos.map(p => p.preco));

  tabela.innerHTML = `<table><thead><tr><th>Fornecedor</th><th>Preço</th><th>Atualizado em</th><th></th></tr></thead><tbody>
    ${precos.map(p => `
      <tr class="${p.preco === menorPreco ? 'linha-mais-barato' : ''}">
        <td>${escapeHtml(p.fornecedor.nome)}${p.preco === menorPreco ? ' 🏆' : ''}</td>
        <td>R$ ${parseFloat(p.preco).toFixed(2).replace('.', ',')}</td>
        <td>${new Date(p.atualizadoEm).toLocaleDateString('pt-BR')}</td>
        <td><button class="btn-icon" onclick="removerPrecoFornecedor(${p.id})" title="Remover">🗑️</button></td>
      </tr>
    `).join('')}
  </tbody></table>`;
}

async function salvarPrecoFornecedor() {
  const fornecedorId = document.getElementById('comp-fornecedor').value;
  const preco = document.getElementById('comp-preco').value;

  if (!fornecedorId || !preco) {
    toast('Selecione o fornecedor e informe o preço', 'erro');
    return;
  }

  const res = await fetchAuth(API + '/ingrediente-fornecedor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ingredienteId: ingredienteAtualHistorico.id,
      fornecedorId: parseInt(fornecedorId),
      preco: parseFloat(preco)
    })
  });

  if (res.ok) {
    toast('Preço salvo!', 'sucesso');
    document.getElementById('comp-preco').value = '';
    await carregarComparacaoFornecedores();
  } else {
    const d = await res.json().catch(() => ({}));
    toast(d.message || 'Erro ao salvar', 'erro');
  }
}

async function removerPrecoFornecedor(id) {
  const ok = await showConfirm('Remover este preço de fornecedor?');
  if (!ok) return;
  const res = await fetchAuth(API + '/ingrediente-fornecedor/' + id, { method: 'DELETE' });
  if (res.ok) {
    toast('Removido', 'sucesso');
    await carregarComparacaoFornecedores();
  } else {
    toast('Erro ao remover', 'erro');
  }
}

const passosTour = [
  {
    seletor: '[data-aba="ingredientes"]',
    titulo: 'Passo 1 — Ingredientes',
    texto: 'Comece cadastrando seus ingredientes aqui: nome, unidade, preço e estoque.'
  },
  {
    seletor: '#btn-add-ingrediente',
    aba: 'ingredientes',
    titulo: 'Adicione seu primeiro ingrediente',
    texto: 'Preencha os campos acima e clique aqui para salvar. Você pode editar depois.'
  },
  {
    seletor: '[data-aba="pratos"]',
    titulo: 'Passo 2 — Pratos',
    texto: 'Agora cadastre os pratos do seu cardápio, com o preço de venda.'
  },
  {
    seletor: '[data-aba="simulador"]',
    titulo: 'Passo 3 — Simulador',
    texto: 'Depois de montar a ficha técnica de um prato (ingredientes + quantidades), use o Simulador para descobrir a margem de lucro e o preço ideal.'
  },
  {
    seletor: '#btn-sino',
    titulo: 'Fique de olho nos alertas',
    texto: 'Aqui você recebe avisos de estoque baixo automaticamente.'
  }
];

let passoAtualTour = 0;

function iniciarTour() {
  passoAtualTour = 0;
  document.getElementById('tour-overlay').style.display = 'block';
  mostrarPassoTour();
}

function mostrarPassoTour() {
  const passo = passosTour[passoAtualTour];

   if (passo.aba) {
    abrirAba(passo.aba);
  }

  const el = document.querySelector(passo.seletor);

  if (!el) {
    proximoPassoTour();
    return;
  }

  const rect = el.getBoundingClientRect();
  const spotlight = document.getElementById('tour-spotlight');
  spotlight.style.top = (rect.top - 6) + 'px';
  spotlight.style.left = (rect.left - 6) + 'px';
  spotlight.style.width = (rect.width + 12) + 'px';
  spotlight.style.height = (rect.height + 12) + 'px';

  const caixa = document.getElementById('tour-caixa');
  document.getElementById('tour-titulo').textContent = passo.titulo;
  document.getElementById('tour-texto').textContent = passo.texto;

  let topCaixa = rect.bottom + 16;
  if (topCaixa + 150 > window.innerHeight) {
    topCaixa = rect.top - 166;
  }
  caixa.style.top = Math.max(16, topCaixa) + 'px';
  caixa.style.left = Math.min(rect.left, window.innerWidth - 340) + 'px';

  document.getElementById('tour-btn-proximo').textContent =
    passoAtualTour === passosTour.length - 1 ? 'Concluir' : 'Próximo';
}

function proximoPassoTour() {
  passoAtualTour++;
  if (passoAtualTour >= passosTour.length) {
    encerrarTour();
    return;
  }
  mostrarPassoTour();
}

function pularTour() {
  encerrarTour();
}

function encerrarTour() {
  document.getElementById('tour-overlay').style.display = 'none';
  localStorage.setItem('tourConcluido', 'true');
}