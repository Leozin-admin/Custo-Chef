const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const prisma = require('../lib/prisma');
const { verificarToken } = require('../middleware/auth');
const { enviarEmail } = require('../lib/email');

const router = express.Router();

async function getRestaurante(usuarioId) {
  return prisma.restaurante.findUnique({ where: { usuarioId } });
}

// GET /membros
router.get('/', verificarToken, async (req, res) => {
  try {
    const restaurante = await getRestaurante(req.usuario.id);
    if (!restaurante) return res.status(404).json({ message: 'Restaurante não encontrado' });

    const membros = await prisma.membro.findMany({
      where: { restauranteId: restaurante.id },
      include: { usuario: { select: { id: true, nome: true, email: true } } },
      orderBy: { criadoEm: 'asc' }
    });
    res.json(membros);
  } catch (err) {
    console.error('Erro em GET /membros:', err);
    res.status(500).json({ message: 'Erro ao buscar membros' });
  }
});

// POST /membros/convidar — convida um novo membro (por email)
router.post('/convidar', verificarToken, async (req, res) => {
  try {
    const restaurante = await getRestaurante(req.usuario.id);
    if (!restaurante) return res.status(404).json({ message: 'Restaurante não encontrado' });

    const { email, papel } = req.body;
    if (!email || !papel) {
      return res.status(400).json({ message: 'Email e papel são obrigatórios' });
    }
    if (!['gerente', 'funcionario'].includes(papel)) {
      return res.status(400).json({ message: 'Papel deve ser gerente ou funcionario' });
    }

    // Verifica se o email já tem usuário
    const usuario = await prisma.usuario.findUnique({ where: { email } });

    if (usuario) {
      // Vincula usuário existente
      const jaEMembro = await prisma.membro.findUnique({
        where: { usuarioId_restauranteId: { usuarioId: usuario.id, restauranteId: restaurante.id } }
      });
      if (jaEMembro) return res.status(400).json({ message: 'Usuário já é membro deste restaurante' });

      const membro = await prisma.membro.create({
        data: {
          usuarioId: usuario.id,
          restauranteId: restaurante.id,
          papel
        },
        include: { usuario: { select: { nome: true, email: true } } }
      });

      return res.status(201).json(membro);
    }

    // Usuário novo: gera senha temporária e envia convite
    const senhaTemp = crypto.randomBytes(4).toString('hex');
    const senhaHash = await bcrypt.hash(senhaTemp, 10);
    const novoUsuario = await prisma.usuario.create({
      data: {
        nome: email.split('@')[0],
        email,
        senha: senhaHash
      }
    });

    const membro = await prisma.membro.create({
      data: {
        usuarioId: novoUsuario.id,
        restauranteId: restaurante.id,
        papel
      },
      include: { usuario: { select: { nome: true, email: true } } }
    });

    await enviarEmail(
      email,
      `Convite para ${restaurante.nome} no CustoChef`,
      `Olá!\n\nVocê foi convidado(a) para fazer parte da equipe de ${restaurante.nome} no CustoChef como ${papel}.\n\nSua senha temporária é: ${senhaTemp}\n\nAcesse: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/`
    );

    res.status(201).json(membro);
  } catch (err) {
    console.error('Erro em POST /membros/convidar:', err);
    res.status(500).json({ message: 'Erro ao convidar membro' });
  }
});

// PATCH /membros/:id — alterar papel
router.patch('/:id', verificarToken, async (req, res) => {
  try {
    const { papel } = req.body;
    if (!['dono', 'gerente', 'funcionario'].includes(papel)) {
      return res.status(400).json({ message: 'Papel inválido' });
    }

    const membro = await prisma.membro.update({
      where: { id: parseInt(req.params.id) },
      data: { papel },
      include: { usuario: { select: { nome: true, email: true } } }
    });
    res.json(membro);
  } catch (err) {
    console.error('Erro em PATCH /membros/:id:', err);
    res.status(500).json({ message: 'Erro ao atualizar membro' });
  }
});

// DELETE /membros/:id
router.delete('/:id', verificarToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const membro = await prisma.membro.findUnique({ where: { id } });
    if (!membro) return res.status(404).json({ message: 'Membro não encontrado' });
    if (membro.papel === 'dono') {
      return res.status(400).json({ message: 'Não é possível remover o dono do restaurante' });
    }
    await prisma.membro.delete({ where: { id } });
    res.json({ message: 'Membro removido' });
  } catch (err) {
    console.error('Erro em DELETE /membros/:id:', err);
    res.status(500).json({ message: 'Erro ao remover membro' });
  }
});

module.exports = router;
