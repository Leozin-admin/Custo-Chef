const express = require('express');
const prisma = require('../lib/prisma');
const { verificarToken } = require('../middleware/auth');
const { cmv: calcCmv, margem: calcMargem, classificarMargem } = require('../lib/calculos');

const router = express.Router();

async function getRestaurante(usuarioId) {
  return prisma.restaurante.findUnique({ where: { usuarioId } });
}

// GET /alertas
router.get('/', verificarToken, async (req, res) => {
  try {
    const restaurante = await getRestaurante(req.usuario.id);
    if (!restaurante) return res.json([]);

    const alertas = await prisma.alerta.findMany({
      where: { restauranteId: restaurante.id },
      orderBy: { criadaEm: 'desc' }
    });
    res.json(alertas);
  } catch (err) {
    console.error('Erro em GET /alertas:', err);
    res.status(500).json({ message: 'Erro ao buscar alertas' });
  }
});

// PATCH /alertas/:id/lida
router.patch('/:id/lida', verificarToken, async (req, res) => {
  try {
    const alerta = await prisma.alerta.update({
      where: { id: parseInt(req.params.id) },
      data: { lida: true }
    });
    res.json(alerta);
  } catch (err) {
    console.error('Erro em PATCH /alertas/:id/lida:', err);
    res.status(500).json({ message: 'Erro ao marcar alerta como lido' });
  }
});

// POST /alertas/marcar-todas
router.post('/marcar-todas', verificarToken, async (req, res) => {
  try {
    const restaurante = await getRestaurante(req.usuario.id);
    if (!restaurante) return res.json({ count: 0 });

    const result = await prisma.alerta.updateMany({
      where: { restauranteId: restaurante.id, lida: false },
      data: { lida: true }
    });
    res.json({ count: result.count });
  } catch (err) {
    console.error('Erro em POST /alertas/marcar-todas:', err);
    res.status(500).json({ message: 'Erro ao marcar alertas' });
  }
});

// DELETE /alertas/:id
router.delete('/:id', verificarToken, async (req, res) => {
  try {
    await prisma.alerta.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Alerta removido' });
  } catch (err) {
    console.error('Erro em DELETE /alertas/:id:', err);
    res.status(500).json({ message: 'Erro ao remover alerta' });
  }
});

// GET /dashboard/stats — KPIs agregados
router.get('/stats', verificarToken, async (req, res) => {
  try {
    const restaurante = await getRestaurante(req.usuario.id);
    if (!restaurante) return res.status(404).json({ message: 'Restaurante não encontrado' });

    const [ingredientes, pratos, alertasNaoLidos, fornecedores] = await Promise.all([
      prisma.ingrediente.findMany({ where: { restauranteId: restaurante.id } }),
      prisma.prato.findMany({
        where: { restauranteId: restaurante.id },
        include: { fichas: { include: { ingrediente: true } } }
      }),
      prisma.alerta.count({ where: { restauranteId: restaurante.id, lida: false } }),
      prisma.fornecedor.count({ where: { restauranteId: restaurante.id } })
    ]);

    // Calcula métricas dos pratos
    const pratosComCalculo = pratos.map(p => {
      const cmvCalculado = calcCmv(p.fichas || []);
      return {
        ...p,
        cmv: cmvCalculado,
        margem: calcMargem(p.precoVenda, cmvCalculado)
      };
    });

    const comFicha = pratosComCalculo.filter(p => p.fichas && p.fichas.length > 0);
    const margemMedia = comFicha.length
      ? comFicha.reduce((acc, p) => acc + p.margem, 0) / comFicha.length
      : 0;

    const pratoTop = comFicha.length
      ? comFicha.reduce((a, b) => a.margem > b.margem ? a : b)
      : null;
    const pior = comFicha.length
      ? comFicha.reduce((a, b) => a.margem < b.margem ? a : b)
      : null;

    const ingredientesBaixo = ingredientes.filter(i => i.estoqueMinimo > 0 && i.estoqueAtual <= i.estoqueMinimo).length;
    const pratosCriticos = comFicha.filter(p => p.margem < 35).length;
    const pratosOtimos = comFicha.filter(p => p.margem >= 60).length;

    // Top 5 pratos
    const top5 = [...comFicha].sort((a, b) => b.margem - a.margem).slice(0, 5);
    const bottom5 = [...comFicha].sort((a, b) => a.margem - b.margem).slice(0, 5);

    // Distribuição por categoria
    const porCategoria = {};
    ingredientes.forEach(i => {
      const cat = i.categoria || 'Sem categoria';
      porCategoria[cat] = (porCategoria[cat] || 0) + 1;
    });

    // Valor total do estoque
    const valorEstoque = ingredientes.reduce((acc, i) => acc + (i.estoqueAtual * i.precoPorUnidade), 0);

    res.json({
      restaurante: { id: restaurante.id, nome: restaurante.nome, plano: restaurante.plano },
      totais: {
        ingredientes: ingredientes.length,
        pratos: pratos.length,
        pratosComFicha: comFicha.length,
        fornecedores,
        alertasNaoLidos,
        ingredientesBaixo,
        pratosCriticos,
        pratosOtimos,
        valorEstoque
      },
      margemMedia,
      pratoTop: pratoTop ? { id: pratoTop.id, nome: pratoTop.nome, margem: pratoTop.margem, cmv: pratoTop.cmv, precoVenda: pratoTop.precoVenda } : null,
      piorPrato: pior ? { id: pior.id, nome: pior.nome, margem: pior.margem, cmv: pior.cmv, precoVenda: pior.precoVenda } : null,
      top5,
      bottom5,
      porCategoria: Object.entries(porCategoria).map(([categoria, total]) => ({ categoria, total })),
      pratos: pratosComCalculo.map(p => ({
        id: p.id, nome: p.nome, categoria: p.categoria, precoVenda: p.precoVenda,
        cmv: p.cmv, margem: p.margem
      }))
    });
  } catch (err) {
    console.error('Erro em GET /dashboard/stats:', err);
    res.status(500).json({ message: 'Erro ao buscar estatísticas' });
  }
});

module.exports = router;
