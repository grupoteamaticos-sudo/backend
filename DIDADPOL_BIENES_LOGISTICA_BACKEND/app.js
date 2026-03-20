// 1️⃣ Cargar variables de entorno primero
require('dotenv').config();

// 2️⃣ Importación de la clase Server
const { Server } = require('./Models/server');

// 3️⃣ Instanciar y arrancar el servidor
const server = new Server();
server.listen();