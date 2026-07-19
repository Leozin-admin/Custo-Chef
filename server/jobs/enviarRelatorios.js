const prisma = require('../lib/prisma');
const { enviarEmail } = require('../lib/email');

async function montarResumoHtml(restaurante) {
  const [totalIngredientes, totalPratos, estoqueBaixo, pratos] = await Promise.all([
    prisma.ingrediente.count({ where: { restauranteId: restaurante.id } }),
    prisma.prato.count({ where: { restauranteId: restaurante.id } }),
    prisma.ingrediente.findMany({
      where: {
        restauranteId: restaurante.id,
        estoqueMinimo: { gt: 0 }
      }
    }),
    prisma.prato.findMany({
      where: { restauranteId: restaurante.id },
      include: { fichas: { include: { ingrediente: true } } }
    })
  ]);

  const itensBaixo = estoqueBaixo.filter(i => i.estoqueAtual <= i.estoqueMinimo);

  let corpo = `Olá! Aqui está o resumo do ${restaurante.nome}:\n\n`;
  corpo += `📦 Ingredientes cadastrados: ${totalIngredientes}\n`;
  corpo += `📋 Pratos cadastrados: ${totalPratos}\n`;
  corpo += `⚠️ Itens com estoque baixo: ${itensBaixo.length}\n`;

  if (itensBaixo.length) {
    corpo += `\nItens que precisam de reposição:\n`;
    itensBaixo.forEach(i => {
      corpo += `  - ${i.nome}: ${i.estoqueAtual} ${i.unidade} (mínimo: ${i.estoqueMinimo})\n`;
    });
  }

  corpo += `\nAcesse o CustoChef para mais detalhes: ${process.env.FRONTEND_URL}/login\n`;
  return corpo;
}

async function enviarRelatoriosPendentes() {
  const agora = new Date();
  const restaurantes = await prisma.restaurante.findMany({
    where: { relatorioEmailAtivo: true },
    include: { usuario: true }
  });

  let enviados = 0;

  for (const restaurante of restaurantes) {
    const ultimoEnvio = restaurante.relatorioUltimoEnvio;
    const frequencia = restaurante.relatorioFrequencia;

    let deveEnviar = false;
    if (!ultimoEnvio) {
      deveEnviar = true;
    } else {
      const horasDesdeUltimo = (agora - new Date(ultimoEnvio)) / (1000 * 60 * 60);
      if (frequencia === 'diario' && horasDesdeUltimo >= 20) deveEnviar = true;
      if (frequencia === 'semanal' && horasDesdeUltimo >= 24 * 6) deveEnviar = true;
    }

    if (!deveEnviar) continue;
    if (!restaurante.usuario?.email) continue;

    const corpo = await montarResumoHtml(restaurante);
    const resultado = await enviarEmail(
      restaurante.usuario.email,
      `CustoChef — Resumo do ${restaurante.nome}`,
      corpo
    );

    console.log(`[relatorio-email] ${restaurante.nome}: ${resultado.ok ? 'enviado' : 'falhou'}`);

    if (resultado.ok) {
      await prisma.restaurante.update({
        where: { id: restaurante.id },
        data: { relatorioUltimoEnvio: agora }
      });
      enviados++;
    }
  }

  return { total: restaurantes.length, enviados };
}

module.exports = { enviarRelatoriosPendentes };