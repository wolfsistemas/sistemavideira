// js/acesso.js - Bloqueio de acesso por assinatura (multi-tenant)
// Uso: em paginas com login, apos criar o cliente Supabase:
//     const acesso = await Acesso.proteger(supabaseClient);
//     if (acesso) return; // bloqueado: tela de aviso ja exibida
(function () {
  let info = null;
  let sbRef = null;

  function mensagemDe(dados) {
    if (!dados) return 'Acesso temporariamente indisponivel';
    if (dados.mensagem) return dados.mensagem;
    if (dados.papel === 'lider' || dados.papel === 'discipulador' || dados.papel === 'membro') {
      return 'Acesso negado, contacte seu pastor de Rede';
    }
    return 'Renove a Assinatura';
  }

  function montarTela(mensagem) {
    if (document.getElementById('acessoBloqueado')) return;
    const div = document.createElement('div');
    div.id = 'acessoBloqueado';
    div.setAttribute('style',
      'position:fixed;inset:0;background:#0f172a;color:#fff;z-index:99999;' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'text-align:center;padding:26px;font-family:inherit;gap:12px;');
    div.innerHTML =
      '<i class="fas fa-lock" style="font-size:2.6rem;color:#f87171;"></i>' +
      '<h2 style="margin:0;font-size:1.25rem;max-width:520px;">' + mensagem + '</h2>' +
      '<p style="margin:0;color:#94a3b8;font-size:0.9rem;max-width:460px;">' +
      'O acesso desta igreja esta suspenso por pendencia na assinatura. ' +
      'Fale com a administracao para regularizar.' +
      '</p>' +
      '<button type="button" id="acessoSair" style="margin-top:8px;padding:12px 24px;border:none;' +
      'border-radius:8px;background:#334155;color:#fff;font-weight:700;cursor:pointer;">Sair</button>';
    document.body.appendChild(div);

    const btn = document.getElementById('acessoSair');
    if (btn) {
      btn.onclick = async function () {
        try { if (sbRef) await sbRef.auth.signOut(); } catch (e) { /* ignora */ }
        window.location.href = 'index.html';
      };
    }
    document.documentElement.style.overflow = 'hidden';
  }

  async function carregar(cliente) {
    sbRef = cliente || sbRef;
    try {
      const { data, error } = await sbRef.rpc('acesso_igreja');
      if (error) throw error;
      info = data || null;
    } catch (e) {
      // Em caso de falha na checagem, NAO bloqueia (evita travar tudo por erro de rede).
      console.warn('Acesso: falha ao verificar', e);
      info = null;
    }
    return info;
  }

  // Retorna true se a pagina deve parar (bloqueado e tela exibida).
  // Admin de igreja bloqueada NAO para aqui: a pagina trata o modo travado.
  async function proteger(cliente, opcoes) {
    const dados = await carregar(cliente);
    if (!dados || dados.liberado) return false;
    if (dados.papel === 'admin' && !(opcoes && opcoes.bloquearAdmin)) return false;
    montarTela(mensagemDe(dados));
    return true;
  }

  window.Acesso = {
    carregar: carregar,
    proteger: proteger,
    bloqueado: function () { return !!(info && !info.liberado); },
    dados: function () { return info; },
  };
})();
