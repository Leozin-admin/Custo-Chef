/* =========================================================
   ui.js — componentes de UI compartilhados
   - Toast (sucesso/erro/info)
   - Modal genérico (confirmação, prompt, alerta)
   ========================================================= */

function ensureUIContainers() {
  if (!document.getElementById('toast-container')) {
    const c = document.createElement('div');
    c.id = 'toast-container';
    document.body.appendChild(c);
  }
  if (!document.getElementById('modal-container')) {
    const m = document.createElement('div');
    m.id = 'modal-container';
    document.body.appendChild(m);
  }
}

/* ================= TOAST ================= */

function toast(msg, tipo = 'info', duracao = 3500) {
  ensureUIContainers();
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'ui-toast ui-toast-' + tipo;
  const icones = { sucesso: '✅', erro: '❌', info: 'ℹ️', alerta: '⚠️' };
  el.innerHTML = `<span class="ui-toast-icon">${icones[tipo] || 'ℹ️'}</span><span class="ui-toast-msg">${escapeHtml(msg)}</span>`;
  container.appendChild(el);
  // animação de entrada
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, duracao);
}

/* ================= MODAL GENÉRICO ================= */

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function openModal({ titulo, corpo, textoConfirmar = 'Confirmar', textoCancelar = 'Cancelar', onConfirmar, esconderCancelar = false } = {}) {
  ensureUIContainers();
  const container = document.getElementById('modal-container');
  const overlay = document.createElement('div');
  overlay.className = 'ui-modal-overlay';
  overlay.innerHTML = `
    <div class="ui-modal" role="dialog" aria-modal="true">
      <button class="ui-modal-close" type="button" aria-label="Fechar">✕</button>
      <h3 class="ui-modal-titulo">${escapeHtml(titulo || '')}</h3>
      <div class="ui-modal-corpo">${typeof corpo === 'string' ? corpo : ''}</div>
      <div class="ui-modal-acoes">
        ${esconderCancelar ? '' : `<button class="ui-btn ui-btn-ghost" data-action="cancelar">${escapeHtml(textoCancelar)}</button>`}
        <button class="ui-btn ui-btn-primario" data-action="confirmar">${escapeHtml(textoConfirmar)}</button>
      </div>
    </div>
  `;
  container.appendChild(overlay);

  // Se corpo for DOM, injeta
  if (typeof corpo !== 'string' && corpo instanceof HTMLElement) {
    overlay.querySelector('.ui-modal-corpo').innerHTML = '';
    overlay.querySelector('.ui-modal-corpo').appendChild(corpo);
  }

  const fechar = () => overlay.remove();
  overlay.querySelector('.ui-modal-close').addEventListener('click', fechar);
  overlay.querySelector('[data-action="cancelar"]')?.addEventListener('click', fechar);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) fechar(); });
  overlay.querySelector('[data-action="confirmar"]').addEventListener('click', async () => {
    try {
      const result = await (onConfirmar ? onConfirmar(overlay) : null);
      if (result !== false) fechar();
    } catch (e) {
      console.error(e);
    }
  });
  // ESC
  const escHandler = (e) => {
    if (e.key === 'Escape') { fechar(); document.removeEventListener('keydown', escHandler); }
  };
  document.addEventListener('keydown', escHandler);

  return overlay;
}

/**
 * showConfirm — substitui window.confirm
 */
function showConfirm({ titulo = 'Confirmar', mensagem = '', textoConfirmar = 'Confirmar', textoCancelar = 'Cancelar', perigo = false } = {}) {
  return new Promise((resolve) => {
    openModal({
      titulo,
      corpo: `<p>${escapeHtml(mensagem)}</p>`,
      textoConfirmar,
      textoCancelar,
      onConfirmar: () => resolve(true)
    });
    // Cancela (botão ou ESC ou clique fora) → resolve false
    const overlay = document.getElementById('modal-container').lastChild;
    const observer = new MutationObserver(() => {
      if (!overlay.isConnected) { resolve(false); observer.disconnect(); }
    });
    observer.observe(document.getElementById('modal-container'), { childList: true });
  });
}

/**
 * showPrompt — substitui window.prompt
 */
function showPrompt({ titulo = 'Digite', label = '', placeholder = '', default: def = '', tipo = 'text', textoConfirmar = 'OK' } = {}) {
  return new Promise((resolve) => {
    const form = document.createElement('form');
    form.innerHTML = `
      <label class="ui-prompt-label">${escapeHtml(label)}</label>
      <input class="ui-prompt-input" type="${tipo}" placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(def)}">
    `;
    const overlay = openModal({
      titulo,
      corpo: form,
      textoConfirmar,
      esconderCancelar: true,
      onConfirmar: (ov) => {
        const input = ov.querySelector('.ui-prompt-input');
        const v = input ? input.value : '';
        resolve(v);
      }
    });
    // Enter submete
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      overlay.querySelector('[data-action="confirmar"]').click();
    });
    const input = form.querySelector('.ui-prompt-input');
    if (input) {
      setTimeout(() => { input.focus(); input.select(); }, 50);
    }
  });
}

/**
 * showForm — modal com form customizado. Recebe campos e chama onSubmit com os valores.
 * campos: [{ name, label, tipo, placeholder, required, default, options: [{value,label}] }]
 */
function showForm({ titulo, campos = [], textoConfirmar = 'Salvar', textoCancelar = 'Cancelar' }) {
  return new Promise((resolve, reject) => {
    const form = document.createElement('form');
    form.className = 'ui-form';
    campos.forEach(c => {
      const wrap = document.createElement('div');
      wrap.className = 'ui-form-grupo';
      const lbl = document.createElement('label');
      lbl.textContent = c.label;
      wrap.appendChild(lbl);
      let inp;
      if (c.tipo === 'select') {
        inp = document.createElement('select');
        (c.options || []).forEach(o => {
          const opt = document.createElement('option');
          opt.value = o.value;
          opt.textContent = o.label;
          if (String(c.default) === String(o.value)) opt.selected = true;
          inp.appendChild(opt);
        });
      } else if (c.tipo === 'textarea') {
        inp = document.createElement('textarea');
        inp.rows = 3;
        if (c.default) inp.value = c.default;
      } else {
        inp = document.createElement('input');
        inp.type = c.tipo || 'text';
        if (c.default != null) inp.value = c.default;
      }
      inp.name = c.name;
      if (c.placeholder) inp.placeholder = c.placeholder;
      if (c.required) inp.required = true;
      if (c.min != null) inp.min = c.min;
      if (c.step != null) inp.step = c.step;
      wrap.appendChild(inp);
      form.appendChild(wrap);
    });
    const overlay = openModal({
      titulo,
      corpo: form,
      textoConfirmar,
      textoCancelar,
      onConfirmar: (ov) => {
        const fd = new FormData(form);
        const out = {};
        for (const [k, v] of fd.entries()) out[k] = v;
        // Validação simples de required
        for (const c of campos) {
          if (c.required && !String(out[c.name] || '').trim()) {
            toast(`${c.label} é obrigatório`, 'erro');
            return false;
          }
        }
        resolve(out);
      }
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      overlay.querySelector('[data-action="confirmar"]').click();
    });
    const observer = new MutationObserver(() => {
      if (!overlay.isConnected) { observer.disconnect(); }
    });
    observer.observe(document.getElementById('modal-container'), { childList: true });
  });
}

// Exposição global
window.toast = toast;
window.showConfirm = showConfirm;
window.showPrompt = showPrompt;
window.showForm = showForm;
window.openModal = openModal;
window.escapeHtml = escapeHtml;
