const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const prisma = require('../lib/prisma');
const { gerarToken, verificarToken } = require('../middleware/auth');
const { enviarEmail } = require('../lib/email');

const router = express.Router();

// POST /cadastro
router.post('/cadastro', async (req, res) => {
  try {
    const { nome, email, senha } = req.body;

    if (!nome || !email || !senha) {
      return res.status(400).json({ message: 'Preencha todos os campos' });
    }
    if (senha.length < 6) {
      return res.status(400).json({ message: 'A senha deve ter pelo menos 6 caracteres' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Email inválido' });
    }

    const usuarioExistente = await prisma.usuario.findUnique({ where: { email } });
    if (usuarioExistente) {
      return res.status(400).json({ message: 'Usuário já existe' });
    }

    const senhaCriptografada = await bcrypt.hash(senha, 10);
    const novoUsuario = await prisma.usuario.create({
      data: { nome, email, senha: senhaCriptografada }
    });

    const token = gerarToken({ id: novoUsuario.id, nome: novoUsuario.nome });
    const refreshToken = crypto.randomBytes(40).toString('hex');
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        usuarioId: novoUsuario.id,
        expiraEm: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 dias
      }
    });

    res.status(201).json({
      message: 'Usuário cadastrado com sucesso!',
      id: novoUsuario.id,
      token,
      refreshToken
    });
  } catch (err) {
    console.error('Erro no cadastro:', err);
    res.status(500).json({ message: 'Erro ao cadastrar' });
  }
});

// POST /login
router.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ message: 'Preencha e-mail e senha' });
    }

    const usuario = await prisma.usuario.findUnique({ where: { email } });
    if (!usuario) return res.status(400).json({ message: 'Usuário não encontrado' });

    const senhaCorreta = await bcrypt.compare(senha, usuario.senha);
    if (!senhaCorreta) return res.status(400).json({ message: 'Senha incorreta' });

    const token = gerarToken({ id: usuario.id, nome: usuario.nome });
    const refreshToken = crypto.randomBytes(40).toString('hex');
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        usuarioId: usuario.id,
        expiraEm: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });

    res.json({
      message: 'Login realizado!',
      token,
      refreshToken,
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email }
    });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ message: 'Erro ao fazer login' });
  }
});

// POST /auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ message: 'Refresh token não fornecido' });

    const tokenDb = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { usuario: true }
    });

    if (!tokenDb || tokenDb.expiraEm < new Date() || !tokenDb.usuario) {
      return res.status(403).json({ message: 'Refresh token inválido ou expirado' });
    }

    const novoToken = gerarToken({ id: tokenDb.usuario.id, nome: tokenDb.usuario.nome });
    res.json({ token: novoToken });
  } catch (err) {
    console.error('Erro no refresh:', err);
    res.status(500).json({ message: 'Erro ao renovar token' });
  }
});

// POST /auth/recuperar-senha
router.post('/recuperar-senha', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email obrigatório' });

    const usuario = await prisma.usuario.findUnique({ where: { email } });
    // Por segurança, sempre retornamos sucesso mesmo se o email não existir
    if (!usuario) {
      return res.json({ message: 'Se o email existir, você receberá as instruções' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiraEm = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await prisma.recuperacaoSenha.upsert({
      where: { usuarioId: usuario.id },
      update: { token, expiraEm, usado: false },
      create: { token, expiraEm, usuarioId: usuario.id }
    });

    const link = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?token=${token}`;
    const resultado = await enviarEmail(
      usuario.email,
      'CustoChef — Recuperação de senha',
      `Olá ${usuario.nome},\n\nClique no link para redefinir sua senha (válido por 1 hora):\n\n${link}\n\nSe não foi você, ignore este email.`
    );

    if (resultado.ok) {
      console.log(`[recuperar-senha] Email enviado para ${email}: sucesso${resultado.id ? ' (id: ' + resultado.id + ')' : ''}${resultado.mode ? ' (modo: ' + resultado.mode + ')' : ''}`);
    } else {
      console.error(`[recuperar-senha] Email enviado para ${email}: falhou`, resultado.error);
    }

    res.json({ message: 'Se o email existir, você receberá as instruções' });
  } catch (err) {
    console.error('Erro em recuperar-senha:', err);
    res.status(500).json({ message: 'Erro ao processar solicitação' });
  }
});

// POST /auth/redefinir-senha
router.post('/redefinir-senha', async (req, res) => {
  try {
    const { token, novaSenha } = req.body;
    if (!token || !novaSenha) {
      return res.status(400).json({ message: 'Token e nova senha são obrigatórios' });
    }
    if (novaSenha.length < 6) {
      return res.status(400).json({ message: 'A senha deve ter pelo menos 6 caracteres' });
    }

    const recuperacao = await prisma.recuperacaoSenha.findUnique({ where: { token } });
    if (!recuperacao || recuperacao.usado || recuperacao.expiraEm < new Date()) {
      return res.status(400).json({ message: 'Token inválido ou expirado' });
    }

    const senhaCriptografada = await bcrypt.hash(novaSenha, 10);
    await prisma.usuario.update({
      where: { id: recuperacao.usuarioId },
      data: { senha: senhaCriptografada }
    });
    await prisma.recuperacaoSenha.update({
      where: { id: recuperacao.id },
      data: { usado: true }
    });

    res.json({ message: 'Senha redefinida com sucesso' });
  } catch (err) {
    console.error('Erro em redefinir-senha:', err);
    res.status(500).json({ message: 'Erro ao redefinir senha' });
  }
});

// GET /perfil
router.get('/perfil', verificarToken, async (req, res) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.usuario.id },
      select: { id: true, nome: true, email: true, criadoEm: true }
    });
    res.json(usuario);
  } catch (err) {
    console.error('Erro em /perfil:', err);
    res.status(500).json({ message: 'Erro ao buscar perfil' });
  }
});

// PUT /perfil — atualizar nome e/ou email
router.put('/perfil', verificarToken, async (req, res) => {
  try {
    const { nome, email, senhaAtual, novaSenha } = req.body;
    const dados = {};

    if (nome) dados.nome = nome;
    if (email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ message: 'Email inválido' });
      }
      const existe = await prisma.usuario.findUnique({ where: { email } });
      if (existe && existe.id !== req.usuario.id) {
        return res.status(400).json({ message: 'Email já em uso' });
      }
      dados.email = email;
    }

    if (novaSenha) {
      if (!senhaAtual) {
        return res.status(400).json({ message: 'Senha atual é obrigatória para alterar a senha' });
      }
      const usuario = await prisma.usuario.findUnique({ where: { id: req.usuario.id } });
      const ok = await bcrypt.compare(senhaAtual, usuario.senha);
      if (!ok) return res.status(400).json({ message: 'Senha atual incorreta' });
      if (novaSenha.length < 6) {
        return res.status(400).json({ message: 'A nova senha deve ter pelo menos 6 caracteres' });
      }
      dados.senha = await bcrypt.hash(novaSenha, 10);
    }

    const usuario = await prisma.usuario.update({
      where: { id: req.usuario.id },
      data: dados,
      select: { id: true, nome: true, email: true, criadoEm: true }
    });
    res.json(usuario);
  } catch (err) {
    console.error('Erro em PUT /perfil:', err);
    res.status(500).json({ message: 'Erro ao atualizar perfil' });
  }
});

module.exports = router;
