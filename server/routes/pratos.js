const express = require('express');
const prisma = require('../lib/prisma');
const { verificarToken } = require('../middleware/auth');
const { cmv: calcCmv, margem: calcMargem, classificarMargem } = require('../lib/calculos');
const { verificarSugestaoPreco } = require('../lib/sugestaoPreco');

const router = express.Router();

async function getRestaurante(usuarioId) {
  return prisma.restaurante.findUnique({ where: { usuarioId } });
}

function pratoComCalculos(prato) {
  const cmvCalculado = calcCmv(prato.fichas || []);
  const margemCalculada = calcMargem(prato.precoVenda, cmvCalculado);
  const status = classificarMargem(margemCalculada);
  return {
    ...prato,
    cmv: cmvCalculado,
    margem: margemCalculada,
    status
  };
}

// GET /pratos
router.get('/', verificarToken, async (req, res) => {
  try {
    const restaurante = await getRestaurante(req.usuario.id);
    if (!restaurante) return res.status(404).json({ message: 'Restaurante não encontrado' });

    const pratos = await prisma.prato.findMany({
      where: { restauranteId: restaurante.id },
      include: {
        fichas: { include: { ingrediente: true } }
      },
      orderBy: { nome: 'asc' }
    });

    res.json(pratos.map(pratoComCalculos));
  } catch (err) {
    console.error('Erro em GET /pratos:', err);
    res.status(500).json({ message: 'Erro ao buscar pratos' });
  }
});

// POST /pratos
router.post('/', verificarToken, async (req, res) => {
  try {
    const { nome, precoVenda, descricao, categoria, tempoPreparo, rendimento } = req.body;
    const restaurante = await getRestaurante(req.usuario.id);
    if (!restaurante) return res.status(404).json({ message: 'Restaurante não encontrado' });

    if (!nome || precoVenda === undefined) {
      return res.status(400).json({ message: 'Nome e preço de venda são obrigatórios' });
    }

    const prato = await prisma.prato.create({
      data: {
        nome,
        precoVenda: parseFloat(precoVenda),
        descricao: descricao || null,
        categoria: categoria || null,
        tempoPreparo: tempoPreparo ? parseInt(tempoPreparo) : null,
        rendimento: rendimento ? parseInt(rendimento) : 1,
        restauranteId: restaurante.id
      },
      include: { fichas: { include: { ingrediente: true } } }
    });
    res.status(201).json(pratoComCalculos(prato));
  } catch (err) {
    console.error('Erro em POST /pratos:', err);
    res.status(500).json({ message: 'Erro ao criar prato' });
  }
});

// PUT /pratos/:id
router.put('/:id', verificarToken, async (req, res) => {
  try {
    const { nome, precoVenda, descricao, categoria, tempoPreparo, rendimento } = req.body;
    const id = parseInt(req.params.id);

    const prato = await prisma.prato.update({
      where: { id },
      data: {
        nome,
        precoVenda: precoVenda !== undefined ? parseFloat(precoVenda) : undefined,
        descricao: descricao !== undefined ? descricao : undefined,
        categoria: categoria !== undefined ? categoria : undefined,
        tempoPreparo: tempoPreparo !== undefined ? (tempoPreparo ? parseInt(tempoPreparo) : null) : undefined,
        rendimento: rendimento !== undefined ? parseInt(rendimento) : undefined
      },
      include: { fichas: { include: { ingrediente: true } } }
    });

    await verificarSugestaoPreco(prato);

    res.json(pratoComCalculos(prato));
  } catch (err) {
    console.error('Erro em PUT /pratos/:id:', err);
    res.status(500).json({ message: 'Erro ao atualizar prato' });
  }
});

// DELETE /pratos/:id
router.delete('/:id', verificarToken, async (req, res) => {
  try {
    await prisma.fichaTecnica.deleteMany({ where: { pratoId: parseInt(req.params.id) } });
    await prisma.prato.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Prato removido' });
  } catch (err) {
    console.error('Erro em DELETE /pratos/:id:', err);
    res.status(500).json({ message: 'Erro ao remover prato' });
  }
});

// GET /pratos/:id/ficha
router.get('/:id/ficha', verificarToken, async (req, res) => {
  try {
    const fichas = await prisma.fichaTecnica.findMany({
      where: { pratoId: parseInt(req.params.id) },
      include: { ingrediente: true }
    });
    res.json(fichas);
  } catch (err) {
    console.error('Erro em GET /pratos/:id/ficha:', err);
    res.status(500).json({ message: 'Erro ao buscar ficha técnica' });
  }
});

// POST /pratos/:id/ficha
router.post('/:id/ficha', verificarToken, async (req, res) => {
  try {
    const { ingredienteId, quantidade } = req.body;
    if (!ingredienteId || !quantidade) {
      return res.status(400).json({ message: 'Ingrediente e quantidade são obrigatórios' });
    }

    const ficha = await prisma.fichaTecnica.create({
      data: {
        pratoId: parseInt(req.params.id),
        ingredienteId: parseInt(ingredienteId),
        quantidade: parseFloat(quantidade)
      },
      include: { ingrediente: true }
    });

    const pratoAtualizado = await prisma.prato.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { fichas: { include: { ingrediente: true } } }
    });
    await verificarSugestaoPreco(pratoAtualizado);

    res.status(201).json(ficha);
  } catch (err) {
    console.error('Erro em POST /pratos/:id/ficha:', err);
    res.status(500).json({ message: 'Erro ao adicionar item à ficha' });
  }
});

// DELETE /ficha/:id
router.delete('/ficha/:id', verificarToken, async (req, res) => {
  try {
    await prisma.fichaTecnica.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Item removido da ficha' });
  } catch (err) {
    console.error('Erro em DELETE /ficha/:id:', err);
    res.status(500).json({ message: 'Erro ao remover item da ficha' });
  }
});

module.exports = router;
