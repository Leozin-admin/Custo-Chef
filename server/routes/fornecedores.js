const express = require('express');
const prisma = require('../lib/prisma');
const { verificarToken } = require('../middleware/auth');

const router = express.Router();

async function getRestaurante(usuarioId) {
  return prisma.restaurante.findUnique({ where: { usuarioId } });
}

// GET /fornecedores
router.get('/', verificarToken, async (req, res) => {
  try {
    const restaurante = await getRestaurante(req.usuario.id);
    if (!restaurante) return res.status(404).json({ message: 'Restaurante não encontrado' });

    const fornecedores = await prisma.fornecedor.findMany({
      where: { restauranteId: restaurante.id },
      include: { ingredientes: true },
      orderBy: { nome: 'asc' }
    });
    res.json(fornecedores);
  } catch (err) {
    console.error('Erro em GET /fornecedores:', err);
    res.status(500).json({ message: 'Erro ao buscar fornecedores' });
  }
});

// POST /fornecedores
router.post('/', verificarToken, async (req, res) => {
  try {
    const { nome, contato, telefone, email, observacoes } = req.body;
    const restaurante = await getRestaurante(req.usuario.id);
    if (!restaurante) return res.status(404).json({ message: 'Restaurante não encontrado' });

    if (!nome) return res.status(400).json({ message: 'Nome é obrigatório' });

    const fornecedor = await prisma.fornecedor.create({
      data: {
        nome,
        contato: contato || null,
        telefone: telefone || null,
        email: email || null,
        observacoes: observacoes || null,
        restauranteId: restaurante.id
      }
    });
    res.status(201).json(fornecedor);
  } catch (err) {
    console.error('Erro em POST /fornecedores:', err);
    res.status(500).json({ message: 'Erro ao criar fornecedor' });
  }
});

// PUT /fornecedores/:id
router.put('/:id', verificarToken, async (req, res) => {
  try {
    const { nome, contato, telefone, email, observacoes } = req.body;
    const id = parseInt(req.params.id);
    const fornecedor = await prisma.fornecedor.update({
      where: { id },
      data: { nome, contato, telefone, email, observacoes }
    });
    res.json(fornecedor);
  } catch (err) {
    console.error('Erro em PUT /fornecedores/:id:', err);
    res.status(500).json({ message: 'Erro ao atualizar fornecedor' });
  }
});

// DELETE /fornecedores/:id
router.delete('/:id', verificarToken, async (req, res) => {
  try {
    await prisma.fornecedor.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Fornecedor removido' });
  } catch (err) {
    console.error('Erro em DELETE /fornecedores/:id:', err);
    res.status(500).json({ message: 'Erro ao remover fornecedor' });
  }
});

module.exports = router;
