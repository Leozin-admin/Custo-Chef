const express = require('express');
const prisma = require('../lib/prisma');
const { verificarToken } = require('../middleware/auth');

const router = express.Router();

// POST /restaurante
router.post('/', verificarToken, async (req, res) => {
  try {
    const { nome, email, telefone, endereco, cnpj } = req.body;
    if (!nome) return res.status(400).json({ message: 'Nome é obrigatório' });

    const existente = await prisma.restaurante.findUnique({ where: { usuarioId: req.usuario.id } });
    if (existente) return res.status(400).json({ message: 'Restaurante já cadastrado' });

    const restaurante = await prisma.restaurante.create({
      data: {
        nome,
        email: email || null,
        telefone: telefone || null,
        endereco: endereco || null,
        cnpj: cnpj || null,
        usuarioId: req.usuario.id
      }
    });

    // Cria o primeiro membro (o próprio dono)
    await prisma.membro.create({
      data: {
        usuarioId: req.usuario.id,
        restauranteId: restaurante.id,
        papel: 'dono'
      }
    });

    res.status(201).json(restaurante);
  } catch (err) {
    console.error('Erro em POST /restaurante:', err);
    res.status(500).json({ message: 'Erro ao criar restaurante' });
  }
});

// GET /restaurante
router.get('/', verificarToken, async (req, res) => {
  try {
    const restaurante = await prisma.restaurante.findUnique({
      where: { usuarioId: req.usuario.id }
    });
    res.json(restaurante);
  } catch (err) {
    console.error('Erro em GET /restaurante:', err);
    res.status(500).json({ message: 'Erro ao buscar restaurante' });
  }
});

// PUT /restaurante
router.put('/', verificarToken, async (req, res) => {
  try {
    const { nome, email, telefone, endereco, cnpj } = req.body;
    const restaurante = await prisma.restaurante.update({
      where: { usuarioId: req.usuario.id },
      data: { nome, email, telefone, endereco, cnpj }
    });
    res.json(restaurante);
  } catch (err) {
    console.error('Erro em PUT /restaurante:', err);
    res.status(500).json({ message: 'Erro ao atualizar restaurante' });
  }
});

module.exports = router;
