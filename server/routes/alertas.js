const express = require('express');
const prisma = require('../lib/prisma');
const { verificarToken } = require('../middleware/auth');
const { verificarAlertaEstoque } = require('../lib/alertas');

const router = express.Router();

async function getRestaurante(usuarioId) {
  return prisma.restaurante.findUnique({ where: { usuarioId } });
}

// GET /alertas?lida=false
router.get('/', verificarToken, async (req, res) => {
  try {
    const restaurante = await getRestaurante(req.usuario.id);
    if (!restaurante) return res.status(404).json({ message: 'Restaurante não encontrado' });

    const where = { restauranteId: restaurante.id };
    if (req.query.lida === 'true') where.lida = true;
    else if (req.query.lida === 'false') where.lida = false;

    const alertas = await prisma.alerta.findMany({
      where,
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
    const restaurante = await getRestaurante(req.usuario.id);
    if (!restaurante) return res.status(404).json({ message: 'Restaurante não encontrado' });

    const alerta = await prisma.alerta.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!alerta || alerta.restauranteId !== restaurante.id) {
      return res.status(404).json({ message: 'Alerta não encontrado' });
    }

    const atualizado = await prisma.alerta.update({
      where: { id: alerta.id },
      data: { lida: true }
    });
    res.json(atualizado);
  } catch (err) {
    console.error('Erro em PATCH /alertas/:id/lida:', err);
    res.status(500).json({ message: 'Erro ao atualizar alerta' });
  }
});

// POST /alertas/sincronizar — backfill: cria alertas para ingredientes que já estão
// abaixo do mínimo hoje, sem duplicar não-lidos. Reaproveita a lógica central.
router.post('/sincronizar', verificarToken, async (req, res) => {
  try {
    const restaurante = await getRestaurante(req.usuario.id);
    if (!restaurante) return res.status(404).json({ message: 'Restaurante não encontrado' });

    const ingredientes = await prisma.ingrediente.findMany({
      where: { restauranteId: restaurante.id, estoqueMinimo: { gt: 0 } }
    });

    let criados = 0;
    let jaExistiam = 0;
    for (const ing of ingredientes) {
      if (ing.estoqueAtual <= ing.estoqueMinimo) {
        const antes = await prisma.alerta.count({
          where: {
            restauranteId: restaurante.id,
            tipo: 'estoque_baixo',
            referenciaId: ing.id,
            lida: false
          }
        });
        await verificarAlertaEstoque(ing);
        if (antes > 0) jaExistiam++;
        else criados++;
      }
    }

    res.json({ ingredientesVerificados: ingredientes.length, criados, jaExistiam });
  } catch (err) {
    console.error('Erro em POST /alertas/sincronizar:', err);
    res.status(500).json({ message: 'Erro ao sincronizar alertas' });
  }
});

module.exports = router;
