const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/database.sqlite');
const DB_DIR = path.dirname(DB_PATH);

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const MIGRATIONS_SQL = `
CREATE TABLE IF NOT EXISTS organizacion (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  logo_url TEXT
);

CREATE TABLE IF NOT EXISTS cliente (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organizacion_id INTEGER NOT NULL,
  nombre TEXT NOT NULL,
  email TEXT,
  rubro TEXT NOT NULL,
  logo_url TEXT,
  FOREIGN KEY (organizacion_id) REFERENCES organizacion(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS encuesta (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organizacion_id INTEGER NOT NULL,
  nombre TEXT NOT NULL,
  rubro TEXT NOT NULL,
  descripcion TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organizacion_id) REFERENCES organizacion(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS formulario (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  encuesta_id INTEGER NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  version INTEGER DEFAULT 1,
  orden INTEGER DEFAULT 0,
  activo INTEGER DEFAULT 1,
  FOREIGN KEY (encuesta_id) REFERENCES encuesta(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS modulo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  formulario_id INTEGER NOT NULL,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  orden INTEGER DEFAULT 0,
  peso REAL DEFAULT 0,
  FOREIGN KEY (formulario_id) REFERENCES formulario(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pregunta (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  modulo_id INTEGER NOT NULL,
  enunciado TEXT NOT NULL,
  tipo TEXT DEFAULT 'single_choice',
  orden INTEGER DEFAULT 0,
  max_points INTEGER DEFAULT 10,
  FOREIGN KEY (modulo_id) REFERENCES modulo(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS opcion (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pregunta_id INTEGER NOT NULL,
  etiqueta TEXT NOT NULL,
  valor TEXT NOT NULL,
  puntos INTEGER,
  FOREIGN KEY (pregunta_id) REFERENCES pregunta(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS local (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER NOT NULL,
  nombre TEXT NOT NULL,
  direccion TEXT,
  ciudad TEXT,
  FOREIGN KEY (cliente_id) REFERENCES cliente(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS visita (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER NOT NULL,
  local_id INTEGER,
  fecha DATE NOT NULL,
  FOREIGN KEY (cliente_id) REFERENCES cliente(id) ON DELETE CASCADE,
  FOREIGN KEY (local_id) REFERENCES local(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS asignacion (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  formulario_id INTEGER NOT NULL,
  cliente_id INTEGER NOT NULL,
  local_id INTEGER,
  visita_id INTEGER,
  shopper_email TEXT NOT NULL,
  shopper_slug TEXT UNIQUE NOT NULL,
  cliente_slug TEXT,
  estado TEXT DEFAULT 'BORRADOR',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (formulario_id) REFERENCES formulario(id) ON DELETE CASCADE,
  FOREIGN KEY (cliente_id) REFERENCES cliente(id) ON DELETE CASCADE,
  FOREIGN KEY (local_id) REFERENCES local(id) ON DELETE SET NULL,
  FOREIGN KEY (visita_id) REFERENCES visita(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS respuesta (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asignacion_id INTEGER NOT NULL,
  pregunta_id INTEGER NOT NULL,
  opcion_id INTEGER,
  puntos_obtenidos INTEGER,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (asignacion_id) REFERENCES asignacion(id) ON DELETE CASCADE,
  FOREIGN KEY (pregunta_id) REFERENCES pregunta(id) ON DELETE CASCADE,
  FOREIGN KEY (opcion_id) REFERENCES opcion(id) ON DELETE SET NULL,
  UNIQUE(asignacion_id, pregunta_id)
);

CREATE TABLE IF NOT EXISTS justificacion_modulo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asignacion_id INTEGER NOT NULL,
  modulo_id INTEGER NOT NULL,
  texto TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (asignacion_id) REFERENCES asignacion(id) ON DELETE CASCADE,
  FOREIGN KEY (modulo_id) REFERENCES modulo(id) ON DELETE CASCADE,
  UNIQUE(asignacion_id, modulo_id)
);

CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asignacion_id INTEGER NOT NULL,
  modulo_id INTEGER NOT NULL,
  url TEXT NOT NULL,
  mime TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (asignacion_id) REFERENCES asignacion(id) ON DELETE CASCADE,
  FOREIGN KEY (modulo_id) REFERENCES modulo(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS auditoria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entidad TEXT NOT NULL,
  entidad_id INTEGER NOT NULL,
  accion TEXT NOT NULL,
  antes_json TEXT,
  despues_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_asignacion_shopper_slug ON asignacion(shopper_slug);
CREATE INDEX IF NOT EXISTS idx_asignacion_cliente_slug ON asignacion(cliente_slug);
CREATE INDEX IF NOT EXISTS idx_asignacion_estado ON asignacion(estado);
CREATE INDEX IF NOT EXISTS idx_respuesta_asignacion ON respuesta(asignacion_id);
CREATE INDEX IF NOT EXISTS idx_media_asignacion ON media(asignacion_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_entidad ON auditoria(entidad, entidad_id);
`;

const SEED_SQL = `
INSERT OR IGNORE INTO organizacion (id, nombre, logo_url) VALUES 
(1, 'Proveedor Mystery Shopper', 'https://via.placeholder.com/200x80/4F46E5/ffffff?text=Mystery+Shopper');

INSERT OR IGNORE INTO cliente (id, organizacion_id, nombre, email, rubro, logo_url) VALUES 
(1, 1, 'Restaurante Demo', 'cliente@demo.com', 'Restaurante', 'https://via.placeholder.com/200x80/10B981/ffffff?text=Cliente+Demo');

INSERT OR IGNORE INTO local (id, cliente_id, nombre, direccion, ciudad) VALUES 
(1, 1, 'Sucursal Centro', 'Av. Principal 123', 'Buenos Aires');

INSERT OR IGNORE INTO encuesta (id, organizacion_id, nombre, rubro, descripcion) VALUES 
(1, 1, 'Evaluación Restaurante', 'Restaurante', 'Encuesta estándar para evaluar experiencia en restaurantes');

INSERT OR IGNORE INTO formulario (id, encuesta_id, nombre, descripcion, version, activo) VALUES 
(1, 1, 'Formulario Restaurante v1', 'Primera versión del formulario de evaluación', 1, 1);

INSERT OR IGNORE INTO modulo (id, formulario_id, titulo, descripcion, orden, peso) VALUES 
(1, 1, 'Baño', 'Evaluación de instalaciones sanitarias', 1, 30),
(2, 1, 'Atención del personal', 'Evaluación del servicio y atención al cliente', 2, 40),
(3, 1, 'Calidad de la comida', 'Evaluación de platos y bebidas', 3, 30);

INSERT OR IGNORE INTO pregunta (id, modulo_id, enunciado, tipo, orden, max_points) VALUES 
(1, 1, '¿El baño estaba limpio?', 'single_choice', 1, 10),
(2, 1, '¿Había papel higiénico disponible?', 'single_choice', 2, 10),
(3, 1, '¿Funcionaban correctamente las instalaciones?', 'single_choice', 3, 10),
(4, 2, '¿El personal fue amable?', 'single_choice', 1, 10),
(5, 2, '¿El tiempo de espera fue razonable?', 'single_choice', 2, 10),
(6, 2, '¿El personal conocía el menú?', 'single_choice', 3, 10),
(7, 3, '¿La comida estaba bien preparada?', 'single_choice', 1, 10),
(8, 3, '¿La presentación era atractiva?', 'single_choice', 2, 10),
(9, 3, '¿La temperatura era adecuada?', 'single_choice', 3, 10);

INSERT OR IGNORE INTO opcion (pregunta_id, etiqueta, valor, puntos) VALUES 
(1, 'Sí', 'si', 10), (1, 'Parcialmente', 'parcial', 5), (1, 'No', 'no', 0), (1, 'No aplica', 'na', NULL),
(2, 'Sí', 'si', 10), (2, 'Parcialmente', 'parcial', 5), (2, 'No', 'no', 0), (2, 'No aplica', 'na', NULL),
(3, 'Sí', 'si', 10), (3, 'Parcialmente', 'parcial', 5), (3, 'No', 'no', 0), (3, 'No aplica', 'na', NULL),
(4, 'Sí', 'si', 10), (4, 'Parcialmente', 'parcial', 5), (4, 'No', 'no', 0), (4, 'No aplica', 'na', NULL),
(5, 'Sí', 'si', 10), (5, 'Parcialmente', 'parcial', 5), (5, 'No', 'no', 0), (5, 'No aplica', 'na', NULL),
(6, 'Sí', 'si', 10), (6, 'Parcialmente', 'parcial', 5), (6, 'No', 'no', 0), (6, 'No aplica', 'na', NULL),
(7, 'Sí', 'si', 10), (7, 'Parcialmente', 'parcial', 5), (7, 'No', 'no', 0), (7, 'No aplica', 'na', NULL),
(8, 'Sí', 'si', 10), (8, 'Parcialmente', 'parcial', 5), (8, 'No', 'no', 0), (8, 'No aplica', 'na', NULL),
(9, 'Sí', 'si', 10), (9, 'Parcialmente', 'parcial', 5), (9, 'No', 'no', 0), (9, 'No aplica', 'na', NULL);

INSERT OR IGNORE INTO asignacion (id, formulario_id, cliente_id, local_id, shopper_email, shopper_slug, cliente_slug, estado) VALUES 
(1, 1, 1, 1, 'shopper@demo.com', 'demo-shopper-slug', 'demo-cliente-slug', 'BORRADOR');
`;

function initializeDatabase() {
  console.log('Inicializando base de datos...');
  
  try {
    db.exec(MIGRATIONS_SQL);
    console.log('✓ Tablas creadas');
    
    db.exec(SEED_SQL);
    console.log('✓ Datos iniciales cargados');
    
    console.log('✓ Base de datos lista');
  } catch (error) {
    console.error('Error al inicializar base de datos:', error);
    throw error;
  }
}

module.exports = {
  db,
  initializeDatabase
};
