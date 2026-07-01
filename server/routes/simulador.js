const express = require('express');
const prisma = require('../lib/prisma');
const { verificarToken } = require('../middleware/auth');
const { cmv: calcCmv, margem: calcMargem, precoSugerido } = require('../lib/calculos');

const router = express.Router();

async function getRestaurante(usuarioId) {
  return prisma.restaurante.findUnique({ where: { usuarioId } });
}

// POST /simular-preco
router.post('/preco', verificarToken, async (req, res) => {
  try {
    const { pratoId, margemDesejada, fichas, precoVenda } = req.body;

    if (margemDesejada === undefined || margemDesejada < 0 || margemDesejada >= 100) {
      return res.status(400).json({ message: 'Margem desejada deve estar entre 0 e 100' });
    }

    let cmvCalculado = 0;
    let pratoNome = '';
    let fichasCompletas = [];

    if (pratoId) {
      const prato = await prisma.prato.findUnique({
        where: { id: parseInt(pratoId) },
        include: { fichas: { include: { ingrediente: true } } }
      });
      if (!prato) return res.status(404).json({ message: 'Prato não encontrado' });
      pratoNome = prato.nome;
      cmvCalculado = calcCmv(prato.fichas);
      fichasCompletas = prato.fichas;
    } else if (Array.isArray(fichas) && fichas.length > 0) {
      // Simulação "do zero" — fichas com ingredienteId + quantidade
      const ingredientes = await prisma.ingrediente.findMany({
        where: { id: { in: fichas.map(f => parseInt(f.ingredienteId)) } }
      });
      fichasCompletas = fichas.map(f => {
        const ing = ingredientes.find(i => i.id === parseInt(f.ingredienteId));
        return { quantidade: parseFloat(f.quantidade), ingrediente: ing || { precoPorUnidade: 0, nome: '?' } };
      });
      cmvCalculado = calcCmv(fichasCompletas);
    } else {
      return res.status(400).json({ message: 'Forneça pratoId ou fichas para simulação' });
    }

    const preco = precoSugerido(cmvCalculado, margemDesejada);
    const lucro = preco ? preco - cmvCalculado : 0;
    const margemAtual = precoVenda ? calcMargem(precoVenda, cmvCalculado) : null;

    // Sensibilidade: mostra margem em diferentes preços
    const sensibilidade = [];
    if (preco) {
      [-20, -10, -5, 0, 5, 10, 20].forEach(variacao => {
        const p = preco * (1 + variacao / 100);
        sensibilidade.push({
          preco: p,
          variacao,
          margem: calcMargem(p, cmvCalculado),
          lucro: p - cmvCalculado
        });
      });
    }

    res.json({
      pratoNome,
      cmv: cmvCalculado,
      precoSugerido: preco,
      lucroEstimado: lucro,
      margemDesejada: parseFloat(margemDesejada),
      margemAtual,
      precoInformado: precoVenda || null,
      fichas: fichasCompletas.map(f => ({
        ingrediente: f.ingrediente.nome,
        unidade: f.ingrediente.unidade,
        quantidade: f.quantidade,
        custo: (parseFloat(f.quantidade) || 0) * (parseFloat(f.ingrediente.precoPorUnidade) || 0)
      })),
      sensibilidade
    });
  } catch (err) {
    console.error('Erro em POST /simular-preco:', err);
    res.status(500).json({ message: 'Erro ao simular preço' });
  }
});

module.exports = router;
