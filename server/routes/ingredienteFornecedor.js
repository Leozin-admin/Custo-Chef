const express = require('express');
const prisma = require('../lib/prisma');
const { verificarToken } = require('../middleware/auth');

const router = express.Router();

async function getRestaurante(usuarioId) {
  return prisma.restaurante.findUnique({ where: { usuarioId } });
}

// GET /ingrediente-fornecedor/:ingredienteId — lista todos os preços desse ingrediente por fornecedor
router.get('/:ingredienteId', verificarToken, async (req, res) => {
  try {
    const ingredienteId = parseInt(req.params.ingredienteId);
    const precos = await prisma.ingredienteFornecedor.findMany({
      where: { ingredienteId },
      include: { fornecedor: true },
      orderBy: { preco: 'asc' }
    });
    res.json(precos);
  } catch (err) {
    console.error('Erro em GET /ingrediente-fornecedor/:ingredienteId:', err);
    res.status(500).json({ message: 'Erro ao buscar preços por fornecedor' });
  }
});

// POST /ingrediente-fornecedor — cria ou atualiza o preço de um ingrediente para um fornecedor
router.post('/', verificarToken, async (req, res) => {
  try {
    const { ingredienteId, fornecedorId, preco, unidade } = req.body;
    if (!ingredienteId || !fornecedorId || preco === undefined) {
      return res.status(400).json({ message: 'ingredienteId, fornecedorId e preco são obrigatórios' });
    }

    const registro = await prisma.ingredienteFornecedor.upsert({
      where: {
        ingredienteId_fornecedorId: {
          ingredienteId: parseInt(ingredienteId),
          fornecedorId: parseInt(fornecedorId)
        }
      },
      update: {
        preco: parseFloat(preco),
        unidade: unidade || null
      },
      create: {
        ingredienteId: parseInt(ingredienteId),
        fornecedorId: parseInt(fornecedorId),
        preco: parseFloat(preco),
        unidade: unidade || null
      },
      include: { fornecedor: true }
    });

    res.status(201).json(registro);
  } catch (err) {
    console.error('Erro em POST /ingrediente-fornecedor:', err);
    res.status(500).json({ message: 'Erro ao salvar preço por fornecedor' });
  }
});

// DELETE /ingrediente-fornecedor/:id
router.delete('/:id', verificarToken, async (req, res) => {
  try {
    await prisma.ingredienteFornecedor.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Removido' });
  } catch (err) {
    console.error('Erro em DELETE /ingrediente-fornecedor/:id:', err);
    res.status(500).json({ message: 'Erro ao remover' });
  }
});

module.exports = router;