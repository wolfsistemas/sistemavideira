(function () {
    function usuarioParaLog(usuario, email) {
        var u = (usuario === null || usuario === undefined) ? '' : String(usuario).trim();
        if (u) return u;
        var e = (email === null || email === undefined) ? '' : String(email).trim();
        var arroba = e.indexOf('@');
        if (arroba > 0) return e.slice(0, arroba);
        return e || 'Desconhecido';
    }

    window.VideiraLog = {
        usuarioParaLog: usuarioParaLog
    };
})();
