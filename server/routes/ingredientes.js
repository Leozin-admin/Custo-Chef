const express = require('express');
const prisma = require('../lib/prisma');
const { verificarToken } = require('../middleware/auth');
const { verificarAlertaEstoque } = require('../lib/alertas');
const { verificarSugestaoPreco } = require('../lib/sugestaoPreco');

const router = express.Router();

async function getRestaurante(usuarioId) {
  return prisma.restaurante.findUnique({ where: { usuarioId } });
}

// GET /ingredientes
router.get('/', verificarToken, async (req, res) => {
  try {
    const restaurante = await getRestaurante(req.usuario.id);
    if (!restaurante) return res.status(404).json({ message: 'Restaurante não encontrado' });

    const ingredientes = await prisma.ingrediente.findMany({
      where: { restauranteId: restaurante.id },
      include: { fornecedor: true },
      orderBy: { nome: 'asc' }
    });
    res.json(ingredientes);
  } catch (err) {
    console.error('Erro em GET /ingredientes:', err);
    res.status(500).json({ message: 'Erro ao buscar ingredientes' });
  }
});

// POST /ingredientes
router.post('/', verificarToken, async (req, res) => {
  try {
    const { nome, unidade, precoPorUnidade, estoqueAtual, estoqueMinimo, categoria, fornecedorId } = req.body;
    const restaurante = await getRestaurante(req.usuario.id);
    if (!restaurante) return res.status(404).json({ message: 'Restaurante não encontrado' });

    if (!nome || !unidade || precoPorUnidade === undefined) {
      return res.status(400).json({ message: 'Nome, unidade e preço são obrigatórios' });
    }

    const ingrediente = await prisma.ingrediente.create({
      data: {
        nome,
        unidade,
        precoPorUnidade: parseFloat(precoPorUnidade),
        estoqueAtual: parseFloat(estoqueAtual) || 0,
        estoqueMinimo: parseFloat(estoqueMinimo) || 0,
        categoria: categoria || null,
        fornecedorId: fornecedorId || null,
        restauranteId: restaurante.id
      },
      include: { fornecedor: true }
    });

    await verificarAlertaEstoque(ingrediente);

    res.status(201).json(ingrediente);
  } catch (err) {
    console.error('Erro em POST /ingredientes:', err);
    res.status(500).json({ message: 'Erro ao criar ingrediente' });
  }
});

// PUT /ingredientes/:id
router.put('/:id', verificarToken, async (req, res) => {
  try {
    const { nome, unidade, precoPorUnidade, estoqueAtual, estoqueMinimo, categoria, fornecedorId } = req.body;
    const id = parseInt(req.params.id);

    const anterior = await prisma.ingrediente.findUnique({ where: { id } });
    if (!anterior) return res.status(404).json({ message: 'Ingrediente não encontrado' });

    // Registra histórico de preço se mudou
    if (precoPorUnidade !== undefined && parseFloat(precoPorUnidade) !== anterior.precoPorUnidade) {
      await prisma.historicoPreco.create({
        data: {
          ingredienteId: id,
          precoAnterior: anterior.precoPorUnidade,
          precoNovo: parseFloat(precoPorUnidade),
          usuarioId: req.usuario.id
        }
      });
    }

    const ingrediente = await prisma.ingrediente.update({
      where: { id },
      data: {
        nome,
        unidade,
        precoPorUnidade: precoPorUnidade !== undefined ? parseFloat(precoPorUnidade) : undefined,
        estoqueAtual: estoqueAtual !== undefined ? parseFloat(estoqueAtual) : undefined,
        estoqueMinimo: estoqueMinimo !== undefined ? parseFloat(estoqueMinimo) : undefined,
        categoria: categoria !== undefined ? categoria : undefined,
        fornecedorId: fornecedorId !== undefined ? (fornecedorId || null) : undefined
      },
      include: { fornecedor: true }
    });

    // Verifica alerta de estoque baixo
    await verificarAlertaEstoque(ingrediente);

    // Reavalia a margem de todos os pratos que usam este ingrediente
    const pratosAfetados = await prisma.prato.findMany({
      where: { fichas: { some: { ingredienteId: id } } },
      include: { fichas: { include: { ingrediente: true } } }
    });
    for (const prato of pratosAfetados) {
      await verificarSugestaoPreco(prato);
    }

    res.json(ingrediente);
  } catch (err) {
    console.error('Erro em PUT /ingredientes/:id:', err);
    res.status(500).json({ message: 'Erro ao atualizar ingrediente' });
  }
});

// DELETE /ingredientes/:id
router.delete('/:id', verificarToken, async (req, res) => {
  try {
    await prisma.ingrediente.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Ingrediente removido' });
  } catch (err) {
    console.error('Erro em DELETE /ingredientes/:id:', err);
    res.status(500).json({ message: 'Erro ao remover ingrediente' });
  }
});

// GET /ingredientes/:id/historico-precos
router.get('/:id/historico-precos', verificarToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const historico = await prisma.historicoPreco.findMany({
      where: { ingredienteId: id },
      orderBy: { dataAlteracao: 'desc' },
      include: { usuario: { select: { nome: true } } }
    });
    res.json(historico);
  } catch (err) {
    console.error('Erro em /historico-precos:', err);
    res.status(500).json({ message: 'Erro ao buscar histórico' });
  }
});

module.exports = router;
