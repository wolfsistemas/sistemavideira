(function () {
  const DISMISS_KEY = 'videira_pwa_install_dismissed';

  function injetarEstilos() {
    if (document.getElementById('videira-pwa-style')) return;
    const style = document.createElement('style');
    style.id = 'videira-pwa-style';
    style.textContent = [
      '#videira-pwa-install{position:fixed;left:12px;right:12px;bottom:16px;z-index:99999;',
      'display:none;align-items:center;gap:12px;background:#0f172a;color:#fff;',
      'padding:12px 14px;border-radius:14px;box-shadow:0 10px 30px rgba(15,23,42,.28);',
      'font-family:Inter,system-ui,sans-serif;box-sizing:border-box;}',
      '#videira-pwa-install *{box-sizing:border-box;}',
      '#videira-pwa-install img{width:40px;height:40px;border-radius:10px;flex:0 0 auto;margin:0;display:block;}',
      '#videira-pwa-install p{margin:0;font-size:13px;line-height:1.3;flex:1 1 auto;min-width:0;color:#fff;text-align:left;}',
      '#videira-pwa-install strong{display:block;font-size:14px;font-weight:700;color:#fff;}',
      '#videira-pwa-install button{width:auto;flex:0 0 auto;margin:0;border:0;border-radius:10px;',
      'padding:8px 12px;font-size:14px;font-weight:700;line-height:1.2;cursor:pointer;',
      'box-sizing:border-box;text-align:center;appearance:none;-webkit-appearance:none;transition:none;}',
      '#videira-pwa-install button:hover{transform:none;}',
      '#videira-pwa-install .pwa-ok{background:#D4AF37;color:#1a1a1a;}',
      '#videira-pwa-install .pwa-ok:hover{background:#c9a430;color:#1a1a1a;}',
      '#videira-pwa-install .pwa-no{background:transparent;color:#cbd5e1;padding:8px;}',
      '#videira-pwa-install .pwa-no:hover{background:transparent;color:#fff;}'
    ].join('');
    document.head.appendChild(style);
  }

  function jaInstalado() {
    return window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
  }

  function registrarSW() {
    if (!('serviceWorker' in navigator)) return;
    const swUrl = new URL('sw.js', window.location.href);
    navigator.serviceWorker.register(swUrl.href, { scope: './' }).catch(function () {});
  }

  function mostrarBanner(deferred) {
    if (jaInstalado()) return;
    if (sessionStorage.getItem(DISMISS_KEY) === '1') return;
    injetarEstilos();

    let box = document.getElementById('videira-pwa-install');
    if (!box) {
      box = document.createElement('div');
      box.id = 'videira-pwa-install';
      box.innerHTML = [
        '<img src="icons/icon-192.png" alt="Videira">',
        '<p><strong>Instalar o app</strong>Acesso rápido na tela inicial</p>',
        '<button type="button" class="pwa-ok">Instalar</button>',
        '<button type="button" class="pwa-no" aria-label="Fechar">x</button>'
      ].join('');
      document.body.appendChild(box);
    }

    box.style.display = 'flex';
    const btnOk = box.querySelector('.pwa-ok');
    const btnNo = box.querySelector('.pwa-no');

    btnOk.onclick = function () {
      box.style.display = 'none';
      deferred.prompt();
      deferred.userChoice.finally(function () {});
    };
    btnNo.onclick = function () {
      sessionStorage.setItem(DISMISS_KEY, '1');
      box.style.display = 'none';
    };
  }

  registrarSW();

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    mostrarBanner(event);
  });
})();
