// 1️⃣ Cargar variables de entorno primero
require('dotenv').config();

// 2️⃣ Importaciones principales
const { Server } = require('./Models/server');

// 3️⃣ Instanciar servidor
const server = new Server();
server.listen();