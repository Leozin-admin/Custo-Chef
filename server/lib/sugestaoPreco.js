/**
 * Lógica central de sugestão de reajuste de preço.
 * Quando a margem de um prato cai abaixo do limite (35%), sugere um novo preço.
 * Segue o mesmo padrão de dedup/auto-resolve do verificarAlertaEstoque.
 */
const prisma = require('./prisma');
const { cmv: calcCmv, margem: calcMargem, precoSugerido } = require('./calculos');

const MARGEM_MINIMA = 35; // mesmo limite usado em classificarMargem para "Baixa"
const MARGEM_ALVO = 50;   // margem que a sugestão tenta alcançar

async function verificarSugestaoPreco(prato) {
  // prato precisa vir com fichas + ingrediente incluídos
  const cmvCalculado = calcCmv(prato.fichas || []);
  const margemAtual = calcMargem(prato.precoVenda, cmvCalculado);

  const margemBaixa = prato.fichas?.length > 0 && margemAtual < MARGEM_MINIMA;

  if (margemBaixa) {
    const existente = await prisma.alerta.findFirst({
      where: {
        restauranteId: prato.restauranteId,
        tipo: 'margem_critica',
        referenciaId: prato.id,
        lida: false
      }
    });

    if (!existente) {
      const novoPreco = precoSugerido(cmvCalculado, MARGEM_ALVO);
      const precoFormatado = novoPreco ? novoPreco.toFixed(2).replace('.', ',') : '—';
      await prisma.alerta.create({
        data: {
          tipo: 'margem_critica',
          mensagem: `${prato.nome} está com margem baixa (${margemAtual.toFixed(1)}%). Preço sugerido: R$ ${precoFormatado} para atingir ${MARGEM_ALVO}% de margem.`,
          referenciaId: prato.id,
          restauranteId: prato.restauranteId
        }
      });
    }
    return { acao: 'criado-ou-ja-existia' };
  }

  // Margem normalizou: marca como lidos os alertas pendentes
  const resolvidos = await prisma.alerta.updateMany({
    where: {
      restauranteId: prato.restauranteId,
      tipo: 'margem_critica',
      referenciaId: prato.id,
      lida: false
    },
    data: { lida: true }
  });
  return { acao: 'normalizou', resolvidos: resolvidos.count };
}

module.exports = { verificarSugestaoPreco };