const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const { createServer } = require('http');

// Los helpers y sockets se mantienen igual
const { socketController } = require('../sockets/controller');
const pool = require('../DB/db');
const { setSocketInstance } = require('../sockets/socket.js');

class Server {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;

    this.serverHttp = createServer(this.app);

    this.io = require('socket.io')(this.serverHttp, {
      cors: {
        origin: true,
        credentials: true,
        methods: ['GET', 'POST']
      }
    });

    setSocketInstance(this.io);

    // Definición de rutas
    this.authPath = '/api/auth';
    this.usersPath = '/api/usuarios';
    this.rolesPath = '/api/roles';
    this.permisosPath = '/api/permisos';
    this.inventarioPath = '/api/inventario';
    this.reservasPath = '/api/reservas';
    this.solicitudesPath = '/api/solicitudes';
    this.kardexPath = '/api/kardex';
    this.registrosPath = '/api/registros';
    this.asignacionesPath = '/api/asignaciones';

    // Ejecución de configuraciones
    this.middlewares();
    this.routes();
    this.sockets();
  }

  // REVISIÓN DE MIDDLEWARES (Aquí estaba el posible bloqueo)
  middlewares() {
    // 1. CORS: Permitir conexiones externas
    this.app.use(cors({ origin: true, credentials: true }));

    // 2. Helmet: Seguridad de encabezados
    this.app.use(helmet({ contentSecurityPolicy: false }));

    // 3. Parseo de JSON y formularios
    this.app.use(express.json({ limit: '100mb' }));
    this.app.use(express.urlencoded({ limit: '100mb', extended: false }));

    // 4. Carpeta pública (Logo y estáticos)
    this.app.use(express.static('public'));

    // NOTA: He quitado el bloque de 'rateLimiter' para evitar que la 
    // conexión a la DB bloquee el arranque en Render.
  }

  routes() {
    this.app.get('/api/health', (req, res) => {
      res.json({ ok: true, message: 'API Bienes & Logística OK ✅' });
    });

    // Rutas de la aplicación
    this.app.use(this.authPath, require('../Routes/auth.js'));
    this.app.use(this.usersPath, require('../Routes/usuarios.js'));
    this.app.use(this.rolesPath, require('../Routes/roles.js'));
    this.app.use(this.permisosPath, require('../Routes/permisos.js'));
    this.app.use(this.inventarioPath, require('../Routes/inventario.js'));
    this.app.use(this.reservasPath, require('../Routes/reservas.js'));
    this.app.use(this.solicitudesPath, require('../Routes/solicitudes.js'));
    this.app.use(this.kardexPath, require('../Routes/kardex.js'));
    this.app.use(this.registrosPath, require('../Routes/registros.js'));
    this.app.use('/api/reportes', require('../Routes/reportes.js'));
    this.app.use(this.asignacionesPath, require('../Routes/asignaciones.js'));

    // Manejo de rutas no encontradas
    this.app.use((req, res) => {
      res.status(404).json({
        ok: false,
        msg: 'Endpoint no encontrado'
      });
    });
  }

  sockets() {
    this.io.on('connection', (socket) => socketController(socket, this.io));
  }

  listen() {
    // Usar 0.0.0.0 es clave para Render
    this.serverHttp.listen(this.port, '0.0.0.0', () => {
      console.log(`✅ Servidor corriendo en puerto ${this.port}`);
    });
  }
}

module.exports = { Server };