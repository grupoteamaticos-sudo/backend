const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const { createServer } = require('http');

const createRateLimiter = require('../Helpers/rate-limiter');
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

    this.authPath = '/api/auth';

    // Seguridad
    this.usersPath = '/api/usuarios';
    this.rolesPath = '/api/roles';
    this.permisosPath = '/api/permisos';

    // Operación
    this.inventarioPath = '/api/inventario';
    this.reservasPath = '/api/reservas';
    this.solicitudesPath = '/api/solicitudes';
    this.kardexPath = '/api/kardex';
    this.registrosPath = '/api/registros';
    this.asignacionesPath = '/api/asignaciones';

    this.middlewares();
    this.routes();
    this.sockets();
  }

  async middlewares() {
    this.app.use(helmet({ contentSecurityPolicy: false }));
    this.app.use(cors({ origin: true, credentials: true }));

    this.app.use(express.json({ limit: '100mb' }));
    this.app.use(
      express.urlencoded({
        limit: `${process.env.FILE_LIMIT}mb`,
        extended: false
      })
    );

    this.app.use(express.static('public'));

    try {
      const rateLimiter = await createRateLimiter({
        storeClient: pool,
        points: 100,
        duration: 60
      });

      this.app.use(async (req, res, next) => {
        try {
          await rateLimiter.consume(req.ip);
          next();
        } catch {
          res.status(429).json({
            ok: false,
            msg: 'Demasiadas solicitudes, intenta más tarde.'
          });
        }
      });
    } catch (error) {
      console.error('Error iniciando rate limiter:', error);
    }
  }

  routes() {
    this.app.get('/api/health', (req, res) => {
      res.json({ ok: true, message: 'API Bienes & Logística OK ✅' });
    });

    this.app.use(this.authPath, require('../Routes/auth.js'));

    // Seguridad
    this.app.use(this.usersPath, require('../Routes/usuarios.js'));
    this.app.use(this.rolesPath, require('../Routes/roles.js'));
    this.app.use(this.permisosPath, require('../Routes/permisos.js'));

    // Operación
    this.app.use(this.inventarioPath, require('../Routes/inventario.js'));
    this.app.use(this.reservasPath, require('../Routes/reservas.js'));
    this.app.use(this.solicitudesPath, require('../Routes/solicitudes.js'));
    this.app.use(this.kardexPath, require('../Routes/kardex.js'));
    this.app.use(this.registrosPath, require('../Routes/registros.js'));
    this.app.use('/api/reportes', require('../Routes/reportes.js'));
    this.app.use(this.asignacionesPath, require('../Routes/asignaciones.js'));

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
    this.serverHttp.listen(this.port, '0.0.0.0', () => {
      console.log(`✅ Servidor corriendo en puerto ${this.port}`);
    });
  }
}

module.exports = {
  Server
};