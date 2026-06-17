const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const cors = require('cors');

const app = express();
const prisma = new PrismaClient();
app.use(express.json());
app.use(cors());

const SEGREDO = '1234';

// ─── AUTH ───────────────────────────────────────────

app.post('/cadastro', async (req, res) => {
  const { nome, email, senha } = req.body;

  const usuarioExistente = await prisma.usuario.findUnique({ where: { email } });
  if (usuarioExistente) {
    return res.status(400).json({ message: 'Usuário já existe' });
  }

  const senhaCriptografada = await bcrypt.hash(senha, 10);

  const novoUsuario = await prisma.usuario.create({
    data: { nome, email, senha: senhaCriptografada }
  });

  res.status(201).json({ message: 'Usuário cadastrado com sucesso!', id: novoUsuario.id });
});

app.post('/login', async (req, res) => {
  const { email, senha } = req.body;

  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario) return res.status(400).json({ message: 'Usuário não encontrado' });

  const senhaCorreta = await bcrypt.compare(senha, usuario.senha);
  if (!senhaCorreta) return res.status(400).json({ message: 'Senha incorreta' });

  const token = jwt.sign({ id: usuario.id, nome: usuario.nome }, SEGREDO, { expiresIn: '1d' });

  res.json({ message: 'Login realizado!', token });
});

function verificarToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token não fornecido' });

  jwt.verify(token, SEGREDO, (err, usuario) => {
    if (err) return res.status(403).json({ message: 'Token inválido' });
    req.usuario = usuario;
    next();
  });
}

app.get('/perfil', verificarToken, async (req, res) => {
  const usuario = await prisma.usuario.findUnique({
    where: { id: req.usuario.id },
    select: { id: true, nome: true, email: true, criadoEm: true }
  });
  res.json(usuario);
});

// ─── RESTAURANTE ────────────────────────────────────

app.post('/restaurante', verificarToken, async (req, res) => {
  const { nome } = req.body;

  const existente = await prisma.restaurante.findUnique({ where: { usuarioId: req.usuario.id } });
  if (existente) return res.status(400).json({ message: 'Restaurante já cadastrado' });

  const restaurante = await prisma.restaurante.create({
    data: { nome, usuarioId: req.usuario.id }
  });

  res.status(201).json(restaurante);
});

app.get('/restaurante', verificarToken, async (req, res) => {
  const restaurante = await prisma.restaurante.findUnique({
    where: { usuarioId: req.usuario.id }
  });
  res.json(restaurante);
});

// ─── INGREDIENTES ────────────────────────────────────

app.get('/ingredientes', verificarToken, async (req, res) => {
  const restaurante = await prisma.restaurante.findUnique({ where: { usuarioId: req.usuario.id } });
  if (!restaurante) return res.status(404).json({ message: 'Restaurante não encontrado' });

  const ingredientes = await prisma.ingrediente.findMany({ where: { restauranteId: restaurante.id } });
  res.json(ingredientes);
});

app.post('/ingredientes', verificarToken, async (req, res) => {
  const { nome, unidade, precoPorUnidade } = req.body;
  const restaurante = await prisma.restaurante.findUnique({ where: { usuarioId: req.usuario.id } });
  if (!restaurante) return res.status(404).json({ message: 'Restaurante não encontrado' });

  const ingrediente = await prisma.ingrediente.create({
    data: { nome, unidade, precoPorUnidade, restauranteId: restaurante.id }
  });
  res.status(201).json(ingrediente);
});

app.delete('/ingredientes/:id', verificarToken, async (req, res) => {
  await prisma.ingrediente.delete({ where: { id: parseInt(req.params.id) } });
  res.json({ message: 'Ingrediente removido' });
});

// ─── PRATOS ──────────────────────────────────────────

app.get('/pratos', verificarToken, async (req, res) => {
  const restaurante = await prisma.restaurante.findUnique({ where: { usuarioId: req.usuario.id } });
  if (!restaurante) return res.status(404).json({ message: 'Restaurante não encontrado' });

  const pratos = await prisma.prato.findMany({
    where: { restauranteId: restaurante.id },
    include: {
      fichas: {
        include: { ingrediente: true }
      }
    }
  });

  const pratosComCMV = pratos.map(prato => {
    const cmv = prato.fichas.reduce((total, ficha) => {
      return total + ficha.quantidade * ficha.ingrediente.precoPorUnidade;
    }, 0);
    const margem = prato.precoVenda > 0 ? ((prato.precoVenda - cmv) / prato.precoVenda) * 100 : 0;
    return { ...prato, cmv, margem };
  });

  res.json(pratosComCMV);
});

app.post('/pratos', verificarToken, async (req, res) => {
  const { nome, precoVenda } = req.body;
  const restaurante = await prisma.restaurante.findUnique({ where: { usuarioId: req.usuario.id } });
  if (!restaurante) return res.status(404).json({ message: 'Restaurante não encontrado' });

  const prato = await prisma.prato.create({
    data: { nome, precoVenda, restauranteId: restaurante.id }
  });
  res.status(201).json(prato);
});

app.delete('/pratos/:id', verificarToken, async (req, res) => {
  await prisma.fichaTecnica.deleteMany({ where: { pratoId: parseInt(req.params.id) } });
  await prisma.prato.delete({ where: { id: parseInt(req.params.id) } });
  res.json({ message: 'Prato removido' });
});

// ─── FICHA TÉCNICA ───────────────────────────────────

app.get('/pratos/:id/ficha', verificarToken, async (req, res) => {
  const fichas = await prisma.fichaTecnica.findMany({
    where: { pratoId: parseInt(req.params.id) },
    include: { ingrediente: true }
  });
  res.json(fichas);
});

app.post('/pratos/:id/ficha', verificarToken, async (req, res) => {
  const { ingredienteId, quantidade } = req.body;

  const ficha = await prisma.fichaTecnica.create({
    data: {
      pratoId: parseInt(req.params.id),
      ingredienteId,
      quantidade
    }
  });
  res.status(201).json(ficha);
});

app.delete('/ficha/:id', verificarToken, async (req, res) => {
  await prisma.fichaTecnica.delete({ where: { id: parseInt(req.params.id) } });
  res.json({ message: 'Item removido da ficha' });
});

// ─────────────────────────────────────────────────────

app.listen(3000, () => {
  console.log('CustoChef rodando na porta 3000!');
});