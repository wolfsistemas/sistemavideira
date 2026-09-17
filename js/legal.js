// js/legal.js - Dados e versao dos documentos legais (Termos de Uso / Privacidade).
// Para atualizar o conteudo juridico, altere a versao aqui e o texto em
// termos.html / privacidade.html. O aceite do usuario fica gravado com essa versao.
(function () {
  const LEGAL = {
    versao: '2026-09-16',
    atualizadoEm: '16 de setembro de 2026',
    sistema: 'Sistema de Células - Videira',
    fornecedor: {
      nome: 'Wolf Sistemas',
      cnpj: '',
      email: 'wolfsaasbr@gmail.com',
      cidade: 'Jataí - Goiás',
    },
  };

  function valor(caminho) {
    return caminho.split('.').reduce(function (o, k) {
      return o == null ? null : o[k];
    }, LEGAL);
  }

  function aplicar() {
    document.querySelectorAll('[data-legal]').forEach(function (el) {
      const v = valor(el.getAttribute('data-legal'));
      if (v != null) el.textContent = v;
    });
    document.querySelectorAll('[data-legal-email]').forEach(function (el) {
      el.textContent = LEGAL.fornecedor.email;
      el.setAttribute('href', 'mailto:' + LEGAL.fornecedor.email);
    });
    document.querySelectorAll('[data-legal-ocultar]').forEach(function (el) {
      const v = valor(el.getAttribute('data-legal-ocultar'));
      if (v == null || String(v).trim() === '') el.style.display = 'none';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', aplicar);
  } else {
    aplicar();
  }

  LEGAL.aplicar = aplicar;
  window.VideiraLegal = LEGAL;
})();
