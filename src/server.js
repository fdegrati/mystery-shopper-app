require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const helmet = require('helmet');

const healthRoutes = require('./routes/health');
const adminRoutes = require('./routes/admin');
const shopperRoutes = require('./routes/shopper');
const clientRoutes = require('./routes/client');
const uploadsRoutes = require('./routes/uploads');

const { initializeDatabase } = require('./services/db');

const app = express();
const PORT = process.env.PORT || 3000;

initializeDatabase();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser(process.env.APP_ADMIN_CODE || 'secret'));

app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use('/health', healthRoutes);
app.use('/admin', adminRoutes);
app.use('/s', shopperRoutes);
app.use('/c', clientRoutes);
app.use('/upload', uploadsRoutes);

app.get('/', (req, res) => {
  res.redirect('/admin');
});

app.use((req, res) => {
  res.status(404).send('404 - Página no encontrada');
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Mystery Shopper App en puerto ${PORT}`);
});
