const jwt = require('jsonwebtoken');
const SEGREDO = process.env.JWT_SECRET || 'c4d0-f3f0-c0-ch3f-s3cr3t-2026';

function gerarToken(payload, expiresIn = '1d') {
  return jwt.sign(payload, SEGREDO, { expiresIn });
}

function verificarTokenJwt(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, SEGREDO, (err, decoded) => {
      if (err) return reject(err);
      resolve(decoded);
    });
  });
}

function verificarToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token não fornecido' });

  verificarTokenJwt(token)
    .then((usuario) => {
      req.usuario = usuario;
      next();
    })
    .catch(() => res.status(403).json({ message: 'Token inválido ou expirado' }));
}

module.exports = { gerarToken, verificarTokenJwt, verificarToken, SEGREDO };
