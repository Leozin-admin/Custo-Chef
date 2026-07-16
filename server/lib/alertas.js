/**
 * Lógica central de alerta de estoque baixo.
 * Garante dedup: nunca cria dois alertas não-lidos para o mesmo ingrediente.
 * Auto-resolve: quando o estoque volta acima do mínimo, marca os não-lidos como lidos.
 */
const prisma = require('./prisma');

async function verificarAlertaEstoque(ingrediente) {
  const abaixoDoMinimo =
    ingrediente.estoqueMinimo > 0 && ingrediente.estoqueAtual <= ingrediente.estoqueMinimo;

  if (abaixoDoMinimo) {
    const existente = await prisma.alerta.findFirst({
      where: {
        restauranteId: ingrediente.restauranteId,
        tipo: 'estoque_baixo',
        referenciaId: ingrediente.id,
        lida: false
      }
    });
    if (!existente) {
      await prisma.alerta.create({
        data: {
          tipo: 'estoque_baixo',
          mensagem: `${ingrediente.nome} está com estoque baixo (${ingrediente.estoqueAtual} ${ingrediente.unidade})`,
          referenciaId: ingrediente.id,
          restauranteId: ingrediente.restauranteId
        }
      });
    }
    return { acao: 'criado-ou-ja-existia' };
  }

  // Estoque normalizou: marca como lidos os alertas pendentes
  const resolvidos = await prisma.alerta.updateMany({
    where: {
      restauranteId: ingrediente.restauranteId,
      tipo: 'estoque_baixo',
      referenciaId: ingrediente.id,
      lida: false
    },
    data: { lida: true }
  });
  return { acao: 'normalizou', resolvidos: resolvidos.count };
}

module.exports = { verificarAlertaEstoque };
