/* =========================================================
   landing.js — header dinâmico + interatividade (CustoChef)
   - IntersectionObserver (reveal on scroll)
   - Contador animado nos stats
   - Tilt 3D nos cards
   - Scroll listener pro header
   - Partículas no hero
   - Ripple nos botões
   ========================================================= */

// Detecta host: localhost em dev, mesmo origin em produção
const API = (function () {
  const host = window.location.hostname;
  if (host === 'localhost' || host.startsWith('127.')) {
    return 'http://localhost:3000';
  }
  return window.location.origin;
})();

// =========================================================
// HEADER DINÂMICO (usuário logado)
// =========================================================

function primeiroNome(nome) {
  if (!nome) return 'amigo';
  return String(nome).trim().split(/\s+/)[0];
}

function renderUsuarioLogado(nome) {
  const entrar = document.getElementById('lp-entrar');
  if (!entrar) return;
  const acoes = entrar.parentElement;
  if (!acoes) return;

  entrar.style.display = 'none';

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
    localStorage.removeItem('refreshToken');
    window.location.reload();
  });
}

async function checarLogin() {
  const token = localStorage.getItem('token');
  if (!token) return;
  try {
    const res = await fetch(API + '/auth/perfil', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      return;
    }
    if (res.ok) {
      const data = await res.json();
      renderUsuarioLogado(data.nome);
    }
  } catch (err) {
    // servidor offline → mantém botão "Entrar"
  }
}

// =========================================================
// REVEAL ON SCROLL
// =========================================================

function initReveal() {
  const elements = document.querySelectorAll('.lp-reveal');
  if (!elements.length || !('IntersectionObserver' in window)) {
    elements.forEach(el => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const delay = entry.target.dataset.revealDelay || 0;
        entry.target.style.setProperty('--reveal-delay', delay + 'ms');
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.15,
    rootMargin: '0px 0px -50px 0px'
  });

  elements.forEach(el => observer.observe(el));
}

// =========================================================
// CONTADOR ANIMADO
// =========================================================

function animateCounter(el) {
  const target = parseInt(el.dataset.target, 10);
  const prefix = el.dataset.prefix || '';
  const suffix = el.dataset.suffix || '';
  const duration = 1600;
  const start = performance.now();

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    el.textContent = prefix + target + suffix;
    return;
  }

  function tick(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(target * eased);
    el.textContent = prefix + current + suffix;
    if (progress < 1) requestAnimationFrame(tick);
    else el.textContent = prefix + target + suffix;
  }

  requestAnimationFrame(tick);
}

function initCounters() {
  const counters = document.querySelectorAll('.lp-counter');
  if (!counters.length) return;

  if (!('IntersectionObserver' in window)) {
    counters.forEach(animateCounter);
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(c => observer.observe(c));
}

// =========================================================
// TILT 3D NOS CARDS
// =========================================================

function initTilt() {
  const cards = document.querySelectorAll('.lp-tilt');
  const isTouch = window.matchMedia('(hover: none)').matches;
  if (isTouch) return;

  cards.forEach(card => {
    let raf = null;

    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = ((y - centerY) / centerY) * -8;
      const rotateY = ((x - centerX) / centerX) * 8;

      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-6px) scale(1.02)`;
      });
    });

    card.addEventListener('mouseleave', () => {
      if (raf) cancelAnimationFrame(raf);
      card.style.transform = '';
    });
  });
}

// =========================================================
// HEADER REATIVO AO SCROLL
// =========================================================

function initHeaderScroll() {
  const header = document.getElementById('lp-header');
  if (!header) return;

  let ticking = false;
  function update() {
    if (window.scrollY > 50) header.classList.add('scrolled');
    else header.classList.remove('scrolled');
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });
}

// =========================================================
// PARTÍCULAS NO HERO
// =========================================================

function initParticles() {
  const container = document.getElementById('lp-particles');
  if (!container) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const count = reduce ? 0 : 15;
  const sizes = [4, 6, 8, 10, 12];
  const colors = [
    'radial-gradient(circle, rgba(255, 214, 10, 0.9), rgba(255, 107, 53, 0))',
    'radial-gradient(circle, rgba(255, 179, 102, 0.9), rgba(255, 107, 53, 0))',
    'radial-gradient(circle, rgba(255, 107, 53, 0.9), rgba(196, 92, 0, 0))',
    'radial-gradient(circle, rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0))'
  ];

  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'lp-particle';
    const size = sizes[i % sizes.length];
    p.style.width = size + 'px';
    p.style.height = size + 'px';
    p.style.left = Math.random() * 100 + '%';
    p.style.bottom = '-' + size + 'px';
    p.style.background = colors[i % colors.length];
    p.style.animationDuration = (8 + Math.random() * 8) + 's';
    p.style.animationDelay = (Math.random() * 8) + 's';
    container.appendChild(p);
  }
}

// =========================================================
// RIPPLE NOS BOTÕES
// =========================================================

function initRipple() {
  const btns = document.querySelectorAll('.lp-btn-ripple');
  btns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const rect = btn.getBoundingClientRect();
      const ripple = document.createElement('span');
      ripple.className = 'lp-ripple-effect';
      const size = Math.max(rect.width, rect.height);
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
      ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
      btn.appendChild(ripple);
      setTimeout(() => ripple.remove(), 700);
    });
  });
}

// =========================================================
// INIT
// =========================================================

function initSparks() {
  const title = document.querySelector('.lp-hero-title');
  if (!title) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  function createSpark() {
    const spark = document.createElement('span');
    const rect = title.getBoundingClientRect();

    const x = Math.random() * rect.width;
    const y = Math.random() * rect.height;

    const size = 4 + Math.random() * 6;
    const colors = ['#ffd60a', '#ff6b35', '#ffb366', '#ffffff', '#c45c00'];
    const color = colors[Math.floor(Math.random() * colors.length)];

    spark.style.cssText = `
      position: fixed;
      left: ${rect.left + x}px;
      top: ${rect.top + y}px;
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      border-radius: 50%;
      pointer-events: none;
      z-index: 999;
      box-shadow: 0 0 ${size * 2}px ${color};
      animation: sparkFly 0.9s ease-out forwards;
    `;

    document.body.appendChild(spark);
    setTimeout(() => spark.remove(), 900);
  }

  setInterval(createSpark, 120);
}

document.addEventListener('DOMContentLoaded', () => {
  
  checarLogin();
  initReveal();
  initCounters();
  initTilt();
  initHeaderScroll();
  initParticles();
  initRipple();
  initSparks();
});
