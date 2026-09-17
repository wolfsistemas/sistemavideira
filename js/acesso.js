// js/acesso.js - Bloqueio de acesso por assinatura (multi-tenant)
// Uso: em paginas com login, apos criar o cliente Supabase:
//     const acesso = await Acesso.proteger(supabaseClient);
//     if (acesso) return; // bloqueado: tela de aviso ja exibida
(function () {
  let info = null;
  let sbRef = null;

  function escapar(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function valorBR(v) {
    const n = Number(v);
    if (!isFinite(n) || n <= 0) return '';
    try {
      return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } catch (e) {
      return 'R$ ' + n.toFixed(2).replace('.', ',');
    }
  }

  function amigavel(dados) {
    return dados && (dados.motivo === 'trial_vencido' || dados.motivo === 'acesso_vencido');
  }

  function mensagemDe(dados) {
    if (!dados) return 'Acesso temporariamente indisponivel';
    if (dados.mensagem) return dados.mensagem;
    if (dados.papel === 'lider' || dados.papel === 'discipulador' || dados.papel === 'membro') {
      return 'Acesso negado, contacte seu pastor de Rede';
    }
    return 'Renove a Assinatura';
  }

  function baseOverlay() {
    const div = document.createElement('div');
    div.id = 'acessoBloqueado';
    div.setAttribute('style',
      'position:fixed;inset:0;background:#0f172a;color:#fff;z-index:99999;' +
      'display:flex;align-items:center;justify-content:center;padding:22px;' +
      'font-family:inherit;overflow-y:auto;');
    document.body.appendChild(div);
    document.documentElement.style.overflow = 'hidden';
    return div;
  }

  async function mensagemErroFuncao(error, fallback) {
    try {
      if (error && error.context && typeof error.context.json === 'function') {
        const j = await error.context.json();
        if (j && j.mensagem) return j.mensagem;
        if (j && j.erro) return j.erro;
      }
    } catch (e) { /* ignora */ }
    return (error && error.message) || fallback;
  }

  // ------------------------------------------------------------------
  // Tela de bloqueio "duro" (inadimplente / cancelado)
  // ------------------------------------------------------------------
  function montarTelaBloqueio(dados) {
    if (document.getElementById('acessoBloqueado')) return;
    const div = baseOverlay();
    div.style.flexDirection = 'column';
    div.style.textAlign = 'center';
    div.style.gap = '12px';
    div.innerHTML =
      '<i class="fas fa-lock" style="font-size:2.6rem;color:#f87171;"></i>' +
      '<h2 style="margin:0;font-size:1.25rem;max-width:520px;">' + escapar(mensagemDe(dados)) + '</h2>' +
      '<p style="margin:0;color:#94a3b8;font-size:0.9rem;max-width:460px;">' +
      'O acesso desta igreja esta suspenso por pendencia na assinatura. ' +
      'Fale com a administracao para regularizar.' +
      '</p>' +
      '<button type="button" id="acessoSair" style="margin-top:8px;padding:12px 24px;border:none;' +
      'border-radius:8px;background:#334155;color:#fff;font-weight:700;cursor:pointer;">Sair</button>';
    document.getElementById('acessoSair').onclick = sair;
  }

  // ------------------------------------------------------------------
  // Tela amigavel "Gostou do sistema?" (trial/acesso vencido)
  // ------------------------------------------------------------------
  function montarTelaUpsell(dados) {
    if (document.getElementById('acessoBloqueado')) return;
    const div = baseOverlay();
    const vencido = dados.motivo === 'acesso_vencido';
    const mensal = valorBR(dados.valor_mensal);
    const anual = valorBR(dados.valor_anual);

    const rotuloMensal = mensal ? ('Assinar mensalidade (' + mensal + '/mês)') : 'Assinar mensalidade (cartão)';
    const rotuloAnual = anual ? ('Plano anual (' + anual + ')') : 'Plano anual (PIX)';

    div.innerHTML =
      '<div style="width:100%;max-width:560px;background:#111c33;border:1px solid #24324f;' +
      'border-radius:18px;padding:26px 22px;text-align:center;box-shadow:0 18px 50px rgba(0,0,0,0.35);">' +
        '<i class="fas fa-heart" style="font-size:2.4rem;color:#D4AF37;"></i>' +
        '<h2 style="margin:10px 0 6px;font-size:1.4rem;color:#fff;">Gostou do sistema?</h2>' +
        '<p style="margin:0 0 10px;color:#cbd5e1;font-size:0.95rem;line-height:1.5;">' +
          (vencido ? 'O acesso da sua igreja venceu.' : 'O período de teste da sua igreja terminou.') +
          ' Este sistema foi planejado para a Videira e ajuda no dia a dia das células, dos membros e dos relatórios.' +
        '</p>' +
        '<p style="margin:0 0 16px;color:#D4AF37;font-size:0.95rem;font-weight:700;">' +
          'No plano anual você garante 12 meses de acesso com desconto.' +
        '</p>' +
        '<div style="display:flex;flex-direction:column;gap:10px;">' +
          '<button type="button" id="acessoPagarCartao" style="padding:14px;border:none;border-radius:10px;' +
            'background:#600018;color:#fff;font-weight:700;font-size:0.98rem;cursor:pointer;">' +
            '<i class="fas fa-credit-card"></i> ' + escapar(rotuloMensal) + '</button>' +
          '<button type="button" id="acessoPagarPix" style="padding:14px;border:none;border-radius:10px;' +
            'background:#14532d;color:#fff;font-weight:700;font-size:0.98rem;cursor:pointer;">' +
            '<i class="fa-brands fa-pix"></i> ' + escapar(rotuloAnual) + '</button>' +
        '</div>' +
        '<div id="acessoStatus" style="margin-top:12px;font-size:0.85rem;color:#94a3b8;min-height:18px;"></div>' +
        '<p style="margin:14px 0 0;color:#64748b;font-size:0.78rem;">' +
          'Qualquer pessoa da igreja pode ajudar a manter o acesso.' +
        '</p>' +
        '<button type="button" id="acessoSair" style="margin-top:14px;background:none;border:none;' +
          'color:#94a3b8;font-size:0.85rem;text-decoration:underline;cursor:pointer;">Sair</button>' +
      '</div>';

    document.getElementById('acessoSair').onclick = sair;
    document.getElementById('acessoPagarCartao').onclick = pagarCartao;
    document.getElementById('acessoPagarPix').onclick = pagarPix;
  }

  function sair() {
    (async function () {
      try { if (sbRef) await sbRef.auth.signOut(); } catch (e) { /* ignora */ }
      window.location.href = 'index.html';
    })();
  }

  function statusTexto(msg, cor) {
    const el = document.getElementById('acessoStatus');
    if (el) el.innerHTML = '<span style="color:' + (cor || '#94a3b8') + ';">' + escapar(msg) + '</span>';
  }

  async function pagarCartao() {
    const btn = document.getElementById('acessoPagarCartao');
    if (btn) btn.disabled = true;
    statusTexto('Criando a assinatura no Mercado Pago...');
    try {
      const { data, error } = await sbRef.functions.invoke('mp-criar-assinatura', { body: {} });
      if (error) throw new Error(await mensagemErroFuncao(error, 'Falha ao criar a assinatura.'));
      if (!data || !data.init_point) throw new Error((data && data.mensagem) || 'Resposta inválida do servidor.');
      window.location.href = data.init_point;
    } catch (e) {
      statusTexto(e.message || 'Falha ao criar a assinatura.', '#f87171');
      if (btn) btn.disabled = false;
    }
  }

  async function pagarPix() {
    const btn = document.getElementById('acessoPagarPix');
    if (btn) btn.disabled = true;
    statusTexto('Gerando o PIX...');
    try {
      const { data, error } = await sbRef.functions.invoke('mp-criar-pix-anual', { body: {} });
      if (error) throw new Error(await mensagemErroFuncao(error, 'Falha ao gerar o PIX.'));
      if (!data || !data.qr_code) throw new Error((data && data.mensagem) || 'Resposta inválida do servidor.');
      abrirPix(data);
    } catch (e) {
      statusTexto(e.message || 'Falha ao gerar o PIX.', '#f87171');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function abrirPix(d) {
    const existente = document.getElementById('acessoPixModal');
    if (existente) existente.remove();

    const modal = document.createElement('div');
    modal.id = 'acessoPixModal';
    modal.setAttribute('style',
      'position:fixed;inset:0;background:rgba(0,0,0,0.72);z-index:100000;display:flex;' +
      'align-items:center;justify-content:center;padding:20px;');
    const qrHtml = d.qr_code_base64
      ? '<img alt="QR Code PIX" style="width:210px;height:210px;background:#fff;border-radius:10px;padding:8px;" src="data:image/png;base64,' + escapar(d.qr_code_base64) + '">'
      : '<div style="color:#94a3b8;font-size:0.85rem;">QR Code indisponível, use o código abaixo.</div>';
    const link = d.ticket_url
      ? '<a href="' + escapar(d.ticket_url) + '" target="_blank" rel="noopener" style="color:#D4AF37;font-size:0.85rem;">Abrir no Mercado Pago</a>'
      : '';

    modal.innerHTML =
      '<div style="width:100%;max-width:420px;background:#fff;color:#1f2937;border-radius:16px;padding:22px;text-align:center;">' +
        '<h3 style="margin:0 0 6px;color:#600018;">Pague com PIX</h3>' +
        '<p style="margin:0 0 14px;color:#6b7280;font-size:0.85rem;">Escaneie o QR Code ou copie o código. A liberação é automática após o pagamento.</p>' +
        '<div style="display:flex;justify-content:center;margin-bottom:12px;">' + qrHtml + '</div>' +
        '<textarea id="acessoPixCodigo" readonly style="width:100%;height:64px;font-size:0.72rem;border:1px solid #d1d5db;border-radius:8px;padding:8px;resize:none;box-sizing:border-box;">' + escapar(d.qr_code || '') + '</textarea>' +
        '<div style="display:flex;gap:8px;margin-top:10px;">' +
          '<button type="button" id="acessoPixCopiar" style="flex:1;padding:11px;border:none;border-radius:8px;background:#600018;color:#fff;font-weight:700;cursor:pointer;">Copiar código</button>' +
          '<button type="button" id="acessoPixVerificar" style="flex:1;padding:11px;border:1px solid #600018;border-radius:8px;background:#fff;color:#600018;font-weight:700;cursor:pointer;">Já paguei</button>' +
        '</div>' +
        (link ? '<div style="margin-top:10px;">' + link + '</div>' : '') +
        '<button type="button" id="acessoPixFechar" style="margin-top:14px;background:none;border:none;color:#6b7280;font-size:0.85rem;text-decoration:underline;cursor:pointer;">Fechar</button>' +
      '</div>';
    document.body.appendChild(modal);

    document.getElementById('acessoPixFechar').onclick = function () { modal.remove(); };
    document.getElementById('acessoPixCopiar').onclick = function () {
      const cod = document.getElementById('acessoPixCodigo');
      const texto = cod ? cod.value : '';
      const ok = function () { if (cod) cod.select(); try { document.execCommand('copy'); } catch (e) { /* ignora */ } alert('Código PIX copiado!'); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(texto).then(ok).catch(ok);
      } else { ok(); }
    };
    document.getElementById('acessoPixVerificar').onclick = function () { window.location.reload(); };
  }

  function montarTela(dados) {
    if (amigavel(dados) && dados.pode_pagar) montarTelaUpsell(dados);
    else montarTelaBloqueio(dados);
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
    montarTela(dados);
    return true;
  }

  window.Acesso = {
    carregar: carregar,
    proteger: proteger,
    bloqueado: function () { return !!(info && !info.liberado); },
    dados: function () { return info; },
  };
})();
