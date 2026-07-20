/**
 * Limites por plano. Ajustar aqui se os valores dos planos mudarem.
 */
const prisma = require('./prisma');

const LIMITES = {
  free: { ingredientes: 1, pratos: 1, membros: 1 },
  pro: { ingredientes: Infinity, pratos: Infinity, membros: Infinity },
  enterprise: { ingredientes: Infinity, pratos: Infinity, membros: Infinity }
};

async function checarLimite(restauranteId, plano, recurso) {
  const limites = LIMITES[plano] || LIMITES.free;
  const limite = limites[recurso];

  if (limite === Infinity) return { permitido: true };

  const contagem = await prisma[recurso === 'ingredientes' ? 'ingrediente' : recurso === 'pratos' ? 'prato' : 'membro']
    .count({ where: { restauranteId } });

  if (contagem >= limite) {
    return {
      permitido: false,
      mensagem: `Seu plano Free permite até ${limite} ${recurso}. Faça upgrade para o plano Pro para cadastrar mais.`
    };
  }

  return { permitido: true };
}

module.exports = { checarLimite, LIMITES };