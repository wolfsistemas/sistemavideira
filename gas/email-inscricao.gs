/**
 * email-inscricao.gs
 * ------------------------------------------------------------------
 * Rotina de e-mails de inscricao em eventos (Google Apps Script).
 *
 * COMO USAR:
 * 1) Cole as funcoes abaixo no seu projeto GAS (o mesmo do GOOGLE_SCRIPT_URL
 *    definido em config.js).
 * 2) No seu `doPost(e)` existente, insira os dois blocos `else if` do
 *    final deste arquivo (bloco "INTEGRACAO NO SEU doPost"). Nao substitua
 *    o seu doPost, apenas adicione as rotas.
 * 3) Autorize o script (Enviar e-mails) na primeira execucao.
 * 4) Faca o deploy novamente ("Nova versao") para o Web App.
 *
 * O front envia:
 *   { action: 'enviarEmailInscricao', payload: {...} }
 *   { action: 'enviarEmailPagamentoConfirmado', payload: {...} }
 */

var CONFIG_EMAIL = {
  NOME_IGREJA: 'Igreja Videira Jatai',
  SITE: 'https://videirajatai.com.br',
  LOGO: 'https://img.linkme.bio/img/2021/05/10141826/logo-videira-circulo-1.png',
  COR_PRIMARIA: '#800020',
  COR_OURO: '#D4AF37',
  EMAIL_CULTO: 'contato@videirajatai.com.br',
  WHATSAPP_IGREJA: '',
  // Copia opcional para a igreja em todo novo cadastro (deixe '' para nao enviar)
  EMAIL_COPIA_IGREJA: ''
};

/** Envia e-mail HTML (com copia opcional). */
function enviarEmailHTML_(para, assunto, html, copia) {
  if (!para) return false;
  var opcoes = { htmlBody: html, name: CONFIG_EMAIL.NOME_IGREJA };
  if (copia) opcoes.cc = copia;
  MailApp.sendEmail(para, assunto, '', opcoes);
  return true;
}

function formatarValorEmail_(v) {
  var n = parseFloat(v || 0);
  if (!n) return 'Gratuito';
  return 'R$ ' + n.toFixed(2).replace('.', ',');
}

function formatarDataEmail_(d) {
  if (!d) return '';
  var p = String(d).split('-');
  return p.length === 3 ? (p[2] + '/' + p[1] + '/' + p[0]) : d;
}

function escapeHtmlEmail_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Layout base dos e-mails (tema vinho/dourado). */
function layoutEmail_(titulo, subtitulo, corpoHTML) {
  return '' +
    '<div style="background:#f4f0f1;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#333;">' +
      '<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.08);">' +
        '<div style="background:' + CONFIG_EMAIL.COR_PRIMARIA + ';padding:24px;text-align:center;">' +
          '<img src="' + CONFIG_EMAIL.LOGO + '" alt="Logo" width="72" height="72" style="border-radius:50%;border:3px solid ' + CONFIG_EMAIL.COR_OURO + ';">' +
          '<h1 style="color:#fff;font-size:20px;margin:12px 0 4px;">' + escapeHtmlEmail_(titulo) + '</h1>' +
          '<div style="color:rgba(255,255,255,0.85);font-size:13px;">' + escapeHtmlEmail_(subtitulo) + '</div>' +
        '</div>' +
        '<div style="height:4px;background:' + CONFIG_EMAIL.COR_OURO + ';"></div>' +
        '<div style="padding:24px;font-size:14px;line-height:1.6;">' + corpoHTML + '</div>' +
        '<div style="padding:16px 24px;border-top:1px solid #eee;text-align:center;font-size:11px;color:#999;">' +
          CONFIG_EMAIL.NOME_IGREJA + ' &bull; ' +
          '<a href="' + CONFIG_EMAIL.SITE + '" style="color:' + CONFIG_EMAIL.COR_PRIMARIA + ';text-decoration:none;">videirajatai.com.br</a>' +
        '</div>' +
      '</div>' +
    '</div>';
}

function linhasEventoEmail_(p) {
  var linhas = '';
  var add = function (rotulo, valor) {
    if (!valor) return;
    linhas += '<tr><td style="padding:4px 12px 4px 0;color:#888;">' + escapeHtmlEmail_(rotulo) + '</td>' +
              '<td style="padding:4px 0;font-weight:bold;">' + escapeHtmlEmail_(valor) + '</td></tr>';
  };
  add('Evento', p.evento);
  add('Data', formatarDataEmail_(p.data_evento) + (p.hora_evento ? ' as ' + p.hora_evento : ''));
  add('Local', p.local);
  add('Valor', formatarValorEmail_(p.valor));
  add('Chave PIX', p.pix_chave);
  return '<table style="width:100%;border-collapse:collapse;margin:12px 0;">' + linhas + '</table>';
}

/** 1) Confirma o recebimento da inscricao. */
function enviarEmailInscricao(p) {
  p = p || {};
  if (!p.email) return { ok: false, motivo: 'sem_email' };

  var corpo =
    '<p>Ola, <strong>' + escapeHtmlEmail_(p.nome) + '</strong>!</p>' +
    '<p>Recebemos sua inscricao:</p>' +
    linhasEventoEmail_(p) +
    (parseFloat(p.valor || 0) > 0
      ? '<p>Para garantir sua vaga, realize o pagamento via PIX' +
        (p.pix_chave ? ' na chave <strong>' + escapeHtmlEmail_(p.pix_chave) + '</strong>' : '') +
        '. Em seguida, a igreja confirmara o pagamento.</p>'
      : '') +
    '<p>Pode fechar esta tela. O comprovante chegara no seu e-mail apos a confirmacao do pagamento.</p>' +
    '<p style="margin-top:20px;">Deus abencoe!<br><strong>' + CONFIG_EMAIL.NOME_IGREJA + '</strong></p>';

  enviarEmailHTML_(
    p.email,
    'Inscricao recebida - ' + (p.evento || 'Evento'),
    layoutEmail_('Inscricao confirmada!', p.evento || 'Evento', corpo),
    CONFIG_EMAIL.EMAIL_COPIA_IGREJA
  );
  return { ok: true };
}

/** 2) Avisa que o pagamento foi confirmado (disparo ao marcar "Confirmar" no painel). */
function enviarEmailPagamentoConfirmado(p) {
  p = p || {};
  if (!p.email) return { ok: false, motivo: 'sem_email' };

  var corpo =
    '<p>Ola, <strong>' + escapeHtmlEmail_(p.nome) + '</strong>!</p>' +
    '<p>Seu pagamento foi <strong style="color:#1e8e3e;">confirmado</strong>. Sua inscricao esta garantida:</p>' +
    linhasEventoEmail_(p) +
    (p.comprovante_url
      ? '<p>Comprovante anexado: <a href="' + escapeHtmlEmail_(p.comprovante_url) + '" style="color:' + CONFIG_EMAIL.COR_PRIMARIA + ';">visualizar comprovante</a></p>'
      : '') +
    (CONFIG_EMAIL.WHATSAPP_IGREJA
      ? '<p>Qualquer duvida, fale com a igreja pelo WhatsApp ' +
        '<a href="https://wa.me/' + CONFIG_EMAIL.WHATSAPP_IGREJA.replace(/\D/g, '') + '" style="color:' + CONFIG_EMAIL.COR_PRIMARIA + ';">' +
        escapeHtmlEmail_(CONFIG_EMAIL.WHATSAPP_IGREJA) + '</a>.</p>'
      : '<p>Qualquer duvida, responda este e-mail.</p>') +
    '<p style="margin-top:20px;">Deus abencoe!<br><strong>' + CONFIG_EMAIL.NOME_IGREJA + '</strong></p>';

  enviarEmailHTML_(
    p.email,
    'Pagamento confirmado - ' + (p.evento || 'Evento'),
    layoutEmail_('Pagamento confirmado', p.evento || 'Evento', corpo)
  );
  return { ok: true };
}

/* ==================================================================
 * INTEGRACAO NO SEU doPost  (NAO substitua o seu doPost)
 * ------------------------------------------------------------------
 * No arquivo GAS que ja roda (buscarAgenda / buscarPalavras /
 * enviarEmail / contador), insira os DOIS blocos `else if` abaixo
 * logo ANTES do `else { throw new Error('Acao nao encontrada') }`.
 *
 * O front envia { action, payload: {...} }, por isso usamos
 * `request.payload || request` — assim tambem funciona se voce
 * mandar os campos "soltos" (request.email, request.nome, ...).
 * ==================================================================

    } else if (request.action === "enviarEmailInscricao") {
      var r1 = enviarEmailInscricao(request.payload || request);
      resposta = { status: r1.ok ? "sucesso" : "aviso", mensagem: "E-mail de inscricao recebido." };

    } else if (request.action === "enviarEmailPagamentoConfirmado") {
      var r2 = enviarEmailPagamentoConfirmado(request.payload || request);
      resposta = { status: r2.ok ? "sucesso" : "aviso", mensagem: "E-mail de confirmacao de pagamento enviado." };

 * ------------------------------------------------------------------
 * ATENCAO: o seu GAS usa a service_role key do Supabase exposta no
 * codigo. Mantenha esse arquivo apenas no seu Apps Script (nunca em
 * repositorio publico) e, de preferencia, rotacione essa chave.
 * ================================================================== */

/** Util para testar no editor do GAS. */
function testeEmailInscricao() {
  enviarEmailInscricao({
    evento: 'Encontro com Deus',
    data_evento: '2026-10-15',
    hora_evento: '19:00',
    local: 'Igreja Videira Jatai',
    valor: 50,
    pix_chave: 'contato@videirajatai.com.br',
    nome: 'Teste',
    email: Session.getActiveUser().getEmail()
  });
}

function testeEmailPagamentoConfirmado() {
  enviarEmailPagamentoConfirmado({
    evento: 'Encontro com Deus',
    data_evento: '2026-10-15',
    hora_evento: '19:00',
    local: 'Igreja Videira Jatai',
    valor: 50,
    pix_chave: 'contato@videirajatai.com.br',
    nome: 'Teste',
    email: Session.getActiveUser().getEmail(),
    comprovante_url: 'https://exemplo.com/comprovante.pdf'
  });
}
