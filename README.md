# Mystery Shopper WebApp

Aplicación web completa para gestión de evaluaciones Mystery Shopper con formularios personalizables, sistema de puntuación automático y dashboard con reportes.

## 🚀 Características

- ✅ Panel de Administración completo
- ✅ Formularios mobile-first para shoppers
- ✅ Dashboard interactivo para clientes con gráficos
- ✅ Sistema de puntuación automático
- ✅ Upload ilimitado de imágenes
- ✅ Exportación a PDF
- ✅ Sin autenticación (acceso por slugs únicos)
- ✅ Auditoría completa de acciones

## 📦 Deploy en Railway

### Paso 1: Conectar repositorio
1. Ve a [Railway.app](https://railway.app)
2. Crea un nuevo proyecto
3. Selecciona "Deploy from GitHub repo"
4. Selecciona este repositorio

### Paso 2: Configurar variables de entorno
En Railway, ve a la pestaña "Variables" y agrega:
```
APP_ADMIN_CODE=tu-codigo-secreto-aqui
APP_BASE_URL=https://tu-proyecto.up.railway.app
ORG_NAME=Tu Empresa Mystery Shopper
```

### Paso 3: Deploy automático
Railway detectará automáticamente `package.json` y ejecutará:
- `npm install`
- `npm start`

¡Listo! Tu app estará disponible en unos minutos.

## 🔗 Links de Acceso

Una vez deployado:

- **Panel Admin**: `https://tu-app.up.railway.app/admin`
- **Shopper Demo**: `https://tu-app.up.railway.app/s/demo-shopper-slug`
- **Cliente Demo**: `https://tu-app.up.railway.app/c/demo-cliente-slug`

## 🔐 Seguridad

- Cambia `APP_ADMIN_CODE` por un código secreto seguro
- Los shoppers y clientes acceden mediante slugs UUID únicos
- Todas las acciones administrativas se auditan

## 📊 Tecnologías

- **Backend**: Node.js + Express
- **Base de datos**: SQLite (persistente)
- **Vistas**: EJS
- **Estilos**: Tailwind CSS
- **Gráficos**: Chart.js
- **Imágenes**: Sharp (procesamiento automático)

## 🎯 Uso Rápido

1. Accede al panel admin con tu código
2. Crea encuestas y formularios
3. Agrega clientes y locales
4. Crea asignaciones (genera links únicos para shoppers)
5. Los shoppers completan evaluaciones
6. Revisa y aprueba en admin
7. Comparte dashboard con clientes

## 📝 Datos Demo

La aplicación incluye datos de ejemplo:
- 1 encuesta "Evaluación Restaurante"
- 3 módulos (Baño, Atención, Comida)
- 1 cliente demo
- 1 asignación demo lista para probar

## 🆘 Soporte

- Documentación completa en el código
- Sistema auto-inicializa la base de datos
- Health check en: `/health`

---

**Desarrollado para servicios de Mystery Shopper profesionales** 🎭
