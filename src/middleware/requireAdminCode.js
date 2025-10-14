const ADMIN_CODE = process.env.APP_ADMIN_CODE || '123456';
const COOKIE_NAME = 'admin_verified';

function requireAdminCode(req, res, next) {
  const cookieCode = req.signedCookies[COOKIE_NAME];
  if (cookieCode === ADMIN_CODE) {
    return next();
  }

  const providedCode = req.body.adminCode || req.query.adminCode || req.headers['x-admin-code'];
  
  if (!providedCode) {
    return res.status(403).json({
      error: 'Código de administrador requerido',
      message: 'Debes proporcionar el código de administrador para realizar esta acción'
    });
  }

  if (providedCode !== ADMIN_CODE) {
    return res.status(403).json({
      error: 'Código inválido',
      message: 'El código de administrador proporcionado no es correcto'
    });
  }

  res.cookie(COOKIE_NAME, ADMIN_CODE, {
    signed: true,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'strict'
  });

  next();
}

function checkAdminCode(req, res, next) {
  const cookieCode = req.signedCookies[COOKIE_NAME];
  req.isAdmin = cookieCode === ADMIN_CODE;
  next();
}

module.exports = {
  requireAdminCode,
  checkAdminCode
};
