const express = require('express');
const prisma = require('../lib/prisma');
const { verificarToken } = require('../middleware/auth');

const router = express.Router();

async function getRestaurante(usuarioId) {
  return prisma.restaurante.findUnique({ where: { usuarioId } });
}

// GET /estoque/movimentacoes
router.get('/movimentacoes', verificarToken, async (req, res) => {
  try {
    const restaurante = await getRestaurante(req.usuario.id);
    if (!restaurante) return res.status(404).json({ message: 'Restaurante não encontrado' });

    const { ingredienteId, dataInicio, dataFim, tipo } = req.query;
    const where = { ingrediente: { restauranteId: restaurante.id } };

    if (ingredienteId) where.ingredienteId = parseInt(ingredienteId);
    if (tipo) where.tipo = tipo;
    if (dataInicio || dataFim) {
      where.data = {};
      if (dataInicio) where.data.gte = new Date(dataInicio);
      if (dataFim) where.data.lte = new Date(dataFim);
    }

    const movimentacoes = await prisma.movimentacaoEstoque.findMany({
      where,
      include: { ingrediente: true },
      orderBy: { data: 'desc' }
    });
    res.json(movimentacoes);
  } catch (err) {
    console.error('Erro em GET /movimentacoes:', err);
    res.status(500).json({ message: 'Erro ao buscar movimentações' });
  }
});

// POST /estoque/movimentacoes
router.post('/movimentacoes', verificarToken, async (req, res) => {
  try {
    const restaurante = await getRestaurante(req.usuario.id);
    if (!restaurante) return res.status(404).json({ message: 'Restaurante não encontrado' });

    const { ingredienteId, tipo, quantidade, custoUnitario, observacao } = req.body;
    if (!ingredienteId || !tipo || quantidade === undefined) {
      return res.status(400).json({ message: 'Ingrediente, tipo e quantidade são obrigatórios' });
    }
    if (!['entrada', 'saida', 'ajuste'].includes(tipo)) {
      return res.status(400).json({ message: 'Tipo deve ser entrada, saida ou ajuste' });
    }

    const ingrediente = await prisma.ingrediente.findUnique({ where: { id: parseInt(ingredienteId) } });
    if (!ingrediente || ingrediente.restauranteId !== restaurante.id) {
      return res.status(404).json({ message: 'Ingrediente não encontrado' });
    }

    const q = parseFloat(quantidade);
    let novoEstoque = ingrediente.estoqueAtual;
    if (tipo === 'entrada') novoEstoque += q;
    else if (tipo === 'saida') novoEstoque -= q;
    else if (tipo === 'ajuste') novoEstoque = q;

    const [movimentacao] = await prisma.$transaction([
      prisma.movimentacaoEstoque.create({
        data: {
          ingredienteId: ingrediente.id,
          tipo,
          quantidade: q,
          custoUnitario: custoUnitario ? parseFloat(custoUnitario) : null,
          observacao: observacao || null
        }
      }),
      prisma.ingrediente.update({
        where: { id: ingrediente.id },
        data: { estoqueAtual: novoEstoque }
      })
    ]);

    // Verifica alerta de estoque baixo
    if (ingrediente.estoqueMinimo > 0 && novoEstoque <= ingrediente.estoqueMinimo) {
      await prisma.alerta.create({
        data: {
          tipo: 'estoque_baixo',
          mensagem: `${ingrediente.nome} está com estoque baixo (${novoEstoque} ${ingrediente.unidade})`,
          referenciaId: ingrediente.id,
          restauranteId: restaurante.id
        }
      });
    }

    res.status(201).json(movimentacao);
  } catch (err) {
    console.error('Erro em POST /movimentacoes:', err);
    res.status(500).json({ message: 'Erro ao registrar movimentação' });
  }
});

// GET /estoque/baixo — ingredientes com estoque atual <= mínimo
router.get('/baixo', verificarToken, async (req, res) => {
  try {
    const restaurante = await getRestaurante(req.usuario.id);
    if (!restaurante) return res.status(404).json({ message: 'Restaurante não encontrado' });

    const ingredientes = await prisma.ingrediente.findMany({
      where: {
        restauranteId: restaurante.id,
        estoqueMinimo: { gt: 0 }
      }
    });

    const baixo = ingredientes.filter(i => i.estoqueAtual <= i.estoqueMinimo);
    res.json(baixo);
  } catch (err) {
    console.error('Erro em GET /baixo:', err);
    res.status(500).json({ message: 'Erro ao buscar ingredientes com estoque baixo' });
  }
});

// GET /estoque/consumo?dias=30 — sumário de consumo por ingrediente
router.get('/consumo', verificarToken, async (req, res) => {
  try {
    const restaurante = await getRestaurante(req.usuario.id);
    if (!restaurante) return res.status(404).json({ message: 'Restaurante não encontrado' });

    const dias = parseInt(req.query.dias) || 30;
    const desde = new Date();
    desde.setDate(desde.getDate() - dias);

    const saidas = await prisma.movimentacaoEstoque.findMany({
      where: {
        tipo: 'saida',
        data: { gte: desde },
        ingrediente: { restauranteId: restaurante.id }
      },
      include: { ingrediente: true }
    });

    // Agrupa por ingrediente
    const consumo = {};
    saidas.forEach(s => {
      const id = s.ingredienteId;
      if (!consumo[id]) {
        consumo[id] = {
          ingrediente: s.ingrediente.nome,
          unidade: s.ingrediente.unidade,
          total: 0
        };
      }
      consumo[id].total += s.quantidade;
    });

    res.json(Object.values(consumo).sort((a, b) => b.total - a.total));
  } catch (err) {
    console.error('Erro em GET /consumo:', err);
    res.status(500).json({ message: 'Erro ao buscar consumo' });
  }
});

module.exports = router;
