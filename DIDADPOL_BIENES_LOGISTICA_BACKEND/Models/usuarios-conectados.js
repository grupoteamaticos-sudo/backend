class UsuariosConectados {

    constructor() {
        this.usuarios = {};
    }

    get usuariosArr () {
        return Object.values(this.usuarios);
    }

    agregarUsuario( usuario) {
        this.usuarios[usuario.t_uid] = usuario;
    }

    desconectarUsuario(uid) {
        delete this.usuarios[uid];
    }
}

module.exports = UsuariosConectados;