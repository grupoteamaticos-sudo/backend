const { comprobarToken } = require("../Helpers/jwt");

const  UsuariosConectados  = require("../Models/usuarios-conectados");

const usuariosConectados = new UsuariosConectados();

const socketController = async ( socket , io) => {

    const token = socket.handshake.headers['authorization'];

    const user = await comprobarToken(token);

    if (!user) {
        return socket.disconnect();
    }

    usuariosConectados.agregarUsuario(user);

    socket.join(`usuario_${user.t_uid}`);

    io.emit('usuarios-conectados', usuariosConectados.usuariosArr);

    socket.on('usuario-desconectado', () => {
        usuariosConectados.desconectarUsuario(user.t_uid);
        io.emit('usuarios-conectados', usuariosConectados.usuariosArr);
    });

    socket.on('disconnect', () => {
        usuariosConectados.desconectarUsuario(user.t_uid);
        io.emit('usuarios-conectados', usuariosConectados.usuariosArr);
    });
    
}

module.exports = {
    socketController
}