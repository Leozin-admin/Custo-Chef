const express = require('express');
const prisma = require('../lib/prisma');
const { verificarToken } = require('../middleware/auth');

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

module.exports = router;
