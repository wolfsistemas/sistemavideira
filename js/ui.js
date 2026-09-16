(function () {
  "use strict";
  if (window.UI) return;

  var CSS_ID = "ui-videira-style";

  var ICONE = {
    sucesso: "fa-circle-check",
    erro: "fa-circle-exclamation",
    aviso: "fa-triangle-exclamation",
    info: "fa-circle-info",
  };

  var CSS = [
    ".ui-toasts{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);display:flex;flex-direction:column;gap:10px;z-index:2147483000;width:calc(100% - 32px);max-width:420px;pointer-events:none;}",
    ".ui-toast{pointer-events:auto;display:flex;align-items:flex-start;gap:12px;background:#fff;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.18);border-left:5px solid #64748b;padding:14px 14px 14px 16px;animation:uiToastIn .28s cubic-bezier(.2,.8,.2,1);}",
    ".ui-toast__icon{font-size:1.1rem;line-height:1.25;margin-top:1px;color:#64748b;}",
    ".ui-toast__body{flex:1;min-width:0;}",
    ".ui-toast__title{font-weight:700;font-size:.9rem;color:#111;margin:0 0 2px;}",
    ".ui-toast__msg{font-size:.86rem;color:#444;margin:0;line-height:1.45;word-wrap:break-word;}",
    ".ui-toast__close{width:auto;height:auto;margin:0;border-radius:0;background:none;border:none;color:#c2c2c2;cursor:pointer;font-size:.85rem;padding:2px 4px;line-height:1;align-self:flex-start;flex:0 0 auto;transition:.15s;}",
    ".ui-toast__close:hover{color:#666;transform:none;}",
    ".ui-toast.saindo{animation:uiToastOut .22s forwards;}",
    ".ui-toast--sucesso{border-left-color:#15803d;}.ui-toast--sucesso .ui-toast__icon{color:#15803d;}",
    ".ui-toast--erro{border-left-color:#b91c1c;}.ui-toast--erro .ui-toast__icon{color:#b91c1c;}",
    ".ui-toast--aviso{border-left-color:#b45309;}.ui-toast--aviso .ui-toast__icon{color:#b45309;}",
    ".ui-toast--info{border-left-color:#1d4ed8;}.ui-toast--info .ui-toast__icon{color:#1d4ed8;}",
    "@keyframes uiToastIn{from{opacity:0;transform:translateY(14px) scale(.98);}to{opacity:1;transform:none;}}",
    "@keyframes uiToastOut{to{opacity:0;transform:translateY(10px) scale(.98);}}",
    "@keyframes uiFade{from{opacity:0;}to{opacity:1;}}",
    "@keyframes uiPop{from{opacity:0;transform:scale(.94) translateY(8px);}to{opacity:1;transform:none;}}",
    ".ui-overlay{position:fixed;inset:0;background:rgba(15,23,42,.5);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:18px;z-index:2147483001;animation:uiFade .2s ease;}",
    ".ui-modal{background:#fff;border-radius:18px;width:100%;max-width:400px;padding:24px 22px 20px;box-shadow:0 24px 60px rgba(0,0,0,.3);animation:uiPop .26s cubic-bezier(.2,.9,.3,1.2);}",
    ".ui-modal__icon{width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.35rem;margin:0 auto 14px;}",
    ".ui-modal__icon--perigo{background:#fee2e2;color:#b91c1c;}",
    ".ui-modal__icon--info{background:#e0e7ff;color:#3730a3;}",
    ".ui-modal__title{margin:0 0 6px;font-size:1.08rem;font-weight:800;color:#111;text-align:center;}",
    ".ui-modal__msg{margin:0 0 18px;font-size:.9rem;color:#555;line-height:1.5;text-align:center;word-wrap:break-word;}",
    ".ui-modal__msg--bloco{white-space:pre-line;text-align:left;max-height:55vh;overflow:auto;}",
    ".ui-modal .ui-modal__field{display:block;width:100%;box-sizing:border-box;margin:0;padding:12px 14px;border:1px solid #ddd;border-radius:10px;background:#fff;color:#111;font-size:.95rem;font-family:inherit;outline:none;transition:border-color .2s,box-shadow .2s;}",
    ".ui-modal .ui-modal__field:focus{border-color:#000;box-shadow:0 0 0 3px rgba(0,0,0,.07);background:#fff;}",
    ".ui-modal__copiar{display:flex;gap:8px;margin-bottom:18px;}",
    ".ui-modal__copiar .ui-modal__field{flex:1;margin-bottom:0;}",
    ".ui-modal__actions{display:flex;gap:10px;}",
    ".ui-btn{flex:1;width:auto;margin:0;padding:12px;border-radius:11px;border:none;font-size:.92rem;font-weight:700;cursor:pointer;font-family:inherit;transition:.18s;display:inline-flex;align-items:center;justify-content:center;gap:7px;}",
    ".ui-btn--ghost{background:#f1f1f3;color:#444;}",
    ".ui-btn--ghost:hover{background:#e6e6e9;}",
    ".ui-btn--primary{background:#000;color:#fff;}",
    ".ui-btn--primary:hover{opacity:.88;}",
    ".ui-btn--danger{background:#b91c1c;color:#fff;}",
    ".ui-btn--danger:hover{opacity:.9;}",
    ".ui-loading{position:fixed;inset:0;background:rgba(15,23,42,.62);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;z-index:2147483002;animation:uiFade .15s ease;}",
    ".ui-loading__spinner{width:46px;height:46px;border-radius:50%;border:4px solid rgba(255,255,255,.28);border-top-color:#fff;animation:uiSpin .8s linear infinite;}",
    ".ui-loading__txt{color:#fff;font-size:.95rem;font-weight:600;font-family:inherit;}",
    "@keyframes uiSpin{to{transform:rotate(360deg);}}",
    "@media (max-width:400px){.ui-toasts{bottom:14px;}.ui-modal{padding:20px 18px 16px;}}",
  ].join("");

  function injetarCSS() {
    if (document.getElementById(CSS_ID)) return;
    var style = document.createElement("style");
    style.id = CSS_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function esc(valor) {
    return String(valor == null ? "" : valor).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var abertos = 0;
  function travarScroll(abrir) {
    if (abrir) {
      abertos++;
      if (abertos === 1) {
        document.body.dataset.uiOverflow = document.body.style.overflow || "";
        document.body.style.overflow = "hidden";
      }
    } else {
      abertos = Math.max(0, abertos - 1);
      if (abertos === 0) document.body.style.overflow = document.body.dataset.uiOverflow || "";
    }
  }

  function toast(mensagem, opcoes) {
    opcoes = opcoes || {};
    injetarCSS();
    var tipo = ICONE[opcoes.tipo] ? opcoes.tipo : "info";
    var wrap = document.getElementById("uiToasts");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "uiToasts";
      wrap.className = "ui-toasts";
      document.body.appendChild(wrap);
    }
    while (wrap.children.length >= 4) wrap.removeChild(wrap.firstChild);

    var el = document.createElement("div");
    el.className = "ui-toast ui-toast--" + tipo;
    el.setAttribute("role", tipo === "erro" ? "alert" : "status");
    el.innerHTML =
      '<i class="fas ' + ICONE[tipo] + ' ui-toast__icon"></i>' +
      '<div class="ui-toast__body">' +
      (opcoes.titulo ? '<p class="ui-toast__title">' + esc(opcoes.titulo) + "</p>" : "") +
      '<p class="ui-toast__msg"></p>' +
      "</div>" +
      '<button class="ui-toast__close" aria-label="Fechar"><i class="fas fa-xmark"></i></button>';
    el.querySelector(".ui-toast__msg").textContent = String(mensagem == null ? "" : mensagem);

    var fechado = false;
    function fechar() {
      if (fechado) return;
      fechado = true;
      el.classList.add("saindo");
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 240);
    }
    var duracao = opcoes.duracao != null ? opcoes.duracao : (tipo === "erro" ? 5200 : 3600);
    var timer = duracao > 0 ? setTimeout(fechar, duracao) : null;

    el.addEventListener("click", function (e) {
      if (e.target.closest(".ui-toast__close")) {
        if (timer) clearTimeout(timer);
        fechar();
      }
    });
    wrap.appendChild(el);
    return { fechar: fechar };
  }

  function confirmar(mensagem, opcoes) {
    opcoes = opcoes || {};
    injetarCSS();
    return new Promise(function (resolve) {
      var perigo = opcoes.perigo === true;
      var overlay = document.createElement("div");
      overlay.className = "ui-overlay";
      overlay.innerHTML =
        '<div class="ui-modal" role="dialog" aria-modal="true">' +
        '<div class="ui-modal__icon ' + (perigo ? "ui-modal__icon--perigo" : "ui-modal__icon--info") + '">' +
        '<i class="fas ' + (perigo ? "fa-triangle-exclamation" : "fa-circle-question") + '"></i></div>' +
        '<h3 class="ui-modal__title"></h3>' +
        '<p class="ui-modal__msg"></p>' +
        '<div class="ui-modal__actions">' +
        '<button type="button" class="ui-btn ui-btn--ghost" data-cancelar></button>' +
        '<button type="button" class="ui-btn ' + (perigo ? "ui-btn--danger" : "ui-btn--primary") + '" data-ok></button>' +
        "</div></div>";
      overlay.querySelector(".ui-modal__title").textContent = opcoes.titulo || (perigo ? "Confirmar exclusão" : "Confirmação");
      overlay.querySelector(".ui-modal__msg").textContent = String(mensagem == null ? "" : mensagem);
      var btnCancelar = overlay.querySelector("[data-cancelar]");
      var btnOk = overlay.querySelector("[data-ok]");
      btnCancelar.textContent = opcoes.textoCancelar || "Cancelar";
      btnOk.textContent = opcoes.textoOk || "Confirmar";

      var anterior = document.activeElement;
      function encerrar(valor) {
        document.removeEventListener("keydown", onKey);
        travarScroll(false);
        overlay.style.animation = "uiFade .15s reverse";
        setTimeout(function () {
          if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
          if (anterior && anterior.focus) { try { anterior.focus(); } catch (e) {} }
        }, 130);
        resolve(valor);
      }
      function onKey(e) {
        if (e.key === "Escape") { e.preventDefault(); encerrar(false); }
        else if (e.key === "Enter") { e.preventDefault(); encerrar(true); }
      }
      btnCancelar.addEventListener("click", function () { encerrar(false); });
      btnOk.addEventListener("click", function () { encerrar(true); });
      overlay.addEventListener("mousedown", function (e) { if (e.target === overlay) encerrar(false); });
      document.addEventListener("keydown", onKey);
      travarScroll(true);
      document.body.appendChild(overlay);
      btnOk.focus();
    });
  }

  function abrirPrompt(mensagem, opcoes) {
    opcoes = opcoes || {};
    injetarCSS();
    return new Promise(function (resolve) {
      var leitura = opcoes.somenteLeitura === true;
      var overlay = document.createElement("div");
      overlay.className = "ui-overlay";
      var campoHtml = leitura
        ? '<div class="ui-modal__copiar"><input class="ui-modal__field" data-campo readonly>' +
          '<button type="button" class="ui-btn ui-btn--ghost" data-copiar style="flex:0 0 auto;padding:0 15px;" aria-label="Copiar"><i class="fas fa-copy"></i></button></div>'
        : '<input class="ui-modal__field" data-campo ' + (opcoes.senha ? 'type="password"' : 'type="text"') + ">";
      overlay.innerHTML =
        '<div class="ui-modal" role="dialog" aria-modal="true">' +
        '<div class="ui-modal__icon ui-modal__icon--info"><i class="fas ' + (opcoes.senha ? "fa-key" : "fa-pen-to-square") + '"></i></div>' +
        '<h3 class="ui-modal__title"></h3>' +
        '<p class="ui-modal__msg"></p>' +
        campoHtml +
        '<div class="ui-modal__actions">' +
        '<button type="button" class="ui-btn ui-btn--ghost" data-cancelar></button>' +
        '<button type="button" class="ui-btn ui-btn--primary" data-ok></button>' +
        "</div></div>";
      overlay.querySelector(".ui-modal__title").textContent = opcoes.titulo || (leitura ? "Copiar" : "Digite");
      overlay.querySelector(".ui-modal__msg").textContent = String(mensagem == null ? "" : mensagem);
      var campo = overlay.querySelector("[data-campo]");
      campo.value = opcoes.valor != null ? String(opcoes.valor) : "";
      if (opcoes.placeholder) campo.placeholder = opcoes.placeholder;
      var btnCancelar = overlay.querySelector("[data-cancelar]");
      var btnOk = overlay.querySelector("[data-ok]");
      btnCancelar.textContent = opcoes.textoCancelar || "Cancelar";
      btnOk.textContent = opcoes.textoOk || "Confirmar";

      var anterior = document.activeElement;
      function encerrar(valor) {
        document.removeEventListener("keydown", onKey);
        travarScroll(false);
        overlay.style.animation = "uiFade .15s reverse";
        setTimeout(function () {
          if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
          if (anterior && anterior.focus) { try { anterior.focus(); } catch (e) {} }
        }, 130);
        resolve(valor);
      }
      function onKey(e) {
        if (e.key === "Escape") { e.preventDefault(); encerrar(null); }
        else if (e.key === "Enter" && !leitura) { e.preventDefault(); encerrar(campo.value); }
      }
      btnCancelar.addEventListener("click", function () { encerrar(null); });
      btnOk.addEventListener("click", function () { encerrar(campo.value); });
      overlay.addEventListener("mousedown", function (e) { if (e.target === overlay) encerrar(null); });
      var btnCopiar = overlay.querySelector("[data-copiar]");
      if (btnCopiar) {
        btnCopiar.addEventListener("click", function () {
          campo.select();
          try { document.execCommand("copy"); } catch (e) {}
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(campo.value).catch(function () {});
          }
          toast("Copiado!", { tipo: "sucesso", duracao: 1800 });
        });
      }
      document.addEventListener("keydown", onKey);
      travarScroll(true);
      document.body.appendChild(overlay);
      campo.focus();
      if (leitura) { try { campo.select(); } catch (e) {} }
    });
  }

  function mensagem(texto, opcoes) {
    opcoes = opcoes || {};
    injetarCSS();
    return new Promise(function (resolve) {
      var tipo = ICONE[opcoes.tipo] ? opcoes.tipo : "aviso";
      var overlay = document.createElement("div");
      overlay.className = "ui-overlay";
      overlay.innerHTML =
        '<div class="ui-modal" role="dialog" aria-modal="true">' +
        '<div class="ui-modal__icon ui-modal__icon--' + (tipo === "erro" ? "perigo" : "info") + '">' +
        '<i class="fas ' + ICONE[tipo] + '"></i></div>' +
        '<h3 class="ui-modal__title"></h3>' +
        '<p class="ui-modal__msg ui-modal__msg--bloco"></p>' +
        '<div class="ui-modal__actions">' +
        '<button type="button" class="ui-btn ui-btn--primary" data-ok></button>' +
        "</div></div>";
      overlay.querySelector(".ui-modal__title").textContent = opcoes.titulo || "Aviso";
      overlay.querySelector(".ui-modal__msg").textContent = String(texto == null ? "" : texto);
      var btnOk = overlay.querySelector("[data-ok]");
      btnOk.textContent = opcoes.textoOk || "Entendi";

      var anterior = document.activeElement;
      function encerrar() {
        document.removeEventListener("keydown", onKey);
        travarScroll(false);
        overlay.style.animation = "uiFade .15s reverse";
        setTimeout(function () {
          if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
          if (anterior && anterior.focus) { try { anterior.focus(); } catch (e) {} }
        }, 130);
        resolve(true);
      }
      function onKey(e) {
        if (e.key === "Escape" || e.key === "Enter") { e.preventDefault(); encerrar(); }
      }
      btnOk.addEventListener("click", encerrar);
      overlay.addEventListener("mousedown", function (e) { if (e.target === overlay) encerrar(); });
      document.addEventListener("keydown", onKey);
      travarScroll(true);
      document.body.appendChild(overlay);
      btnOk.focus();
    });
  }

  function restrito(mensagem, url) {
    toast(mensagem || "Acesso restrito.", { tipo: "erro" });
    setTimeout(function () { window.location.href = url || "index.html"; }, 1400);
  }

  // Overlay de "Carregando" (fundo escuro, SEM blur - o blur trava alguns
  // navegadores). Retorna uma funcao para fechar; seguro chamar mais de uma vez.
  function carregando(texto) {
    injetarCSS();
    var overlay = document.createElement("div");
    overlay.className = "ui-loading";
    var spinner = document.createElement("div");
    spinner.className = "ui-loading__spinner";
    var txt = document.createElement("div");
    txt.className = "ui-loading__txt";
    txt.textContent = texto || "Carregando...";
    overlay.appendChild(spinner);
    overlay.appendChild(txt);
    document.body.appendChild(overlay);
    var fechado = false;
    return function () {
      if (fechado) return;
      fechado = true;
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    };
  }

  window.UI = { toast: toast, confirmar: confirmar, prompt: abrirPrompt, mensagem: mensagem, restrito: restrito, carregando: carregando };
})();
