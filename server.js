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

// Cadastro
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

// Login
app.post('/login', async (req, res) => {
  const { email, senha } = req.body;

  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario) {
    return res.status(400).json({ message: 'Usuário não encontrado' });
  }

  const senhaCorreta = await bcrypt.compare(senha, usuario.senha);
  if (!senhaCorreta) {
    return res.status(400).json({ message: 'Senha incorreta' });
  }

  const token = jwt.sign({ id: usuario.id, nome: usuario.nome }, SEGREDO, { expiresIn: '1d' });

  res.json({ message: 'Login realizado!', token });
});

// Middleware de autenticação
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

// Perfil protegido
app.get('/perfil', verificarToken, async (req, res) => {
  const usuario = await prisma.usuario.findUnique({
    where: { id: req.usuario.id },
    select: { id: true, nome: true, email: true, peso: true, altura: true, meta: true, criadoEm: true }
  });

  res.json(usuario);
});

app.listen(3000, () => {
  console.log('Servidor rodando na porta 3000!');
});