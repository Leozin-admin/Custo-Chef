/**
 * Funções puras de cálculo financeiro para restaurantes.
 * Todas as funções recebem números e retornam números.
 */

function cmv(fichas = []) {
  return fichas.reduce((total, f) => {
    const q = parseFloat(f.quantidade) || 0;
    const p = parseFloat(f.ingrediente?.precoPorUnidade) || 0;
    return total + q * p;
  }, 0);
}

function margem(precoVenda, cmvCalculado) {
  const pv = parseFloat(precoVenda) || 0;
  if (pv <= 0) return 0;
  return ((pv - cmvCalculado) / pv) * 100;
}

function foodCost(cmvCalculado, precoVenda) {
  const pv = parseFloat(precoVenda) || 0;
  if (pv <= 0) return 0;
  return (cmvCalculado / pv) * 100;
}

function precoSugerido(cmvCalculado, margemDesejada) {
  const cmvNum = parseFloat(cmvCalculado) || 0;
  const m = parseFloat(margemDesejada) || 0;
  if (m >= 100) return null; // impossível
  return cmvNum / (1 - m / 100);
}

function lucro(precoVenda, cmvCalculado) {
  return (parseFloat(precoVenda) || 0) - (parseFloat(cmvCalculado) || 0);
}

function classificarMargem(m) {
  if (m >= 60) return { label: 'Ótima', cor: 'verde' };
  if (m >= 35) return { label: 'Regular', cor: 'amarelo' };
  return { label: 'Baixa', cor: 'vermelho' };
}

module.exports = { cmv, margem, foodCost, precoSugerido, lucro, classificarMargem };
