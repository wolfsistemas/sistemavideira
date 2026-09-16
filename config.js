// config.js - Configurações centralizadas do Sistema Videira
// ATUALIZE ESTE ARQUIVO PARA ALTERAR CHAVES EM TODOS OS PAINÉIS

const SUPABASE_URL = 'https://ctobdkstnrhepixyujms.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0b2Jka3N0bnJoZXBpeHl1am1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MTAyOTAsImV4cCI6MjA5Mjk4NjI5MH0.mDuYyQI4rV4KsxN9SsfJj9zmiTx-KZlblcLq22KfIWg';

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxnystn3UqAKnfLUgw7tXS8CzrnpxTS0iax80rhMCRs-T47ibodGYvbRw2KRrtsnCzn/exec';

const VAPID_PUBLIC_KEY = 'BAjU5rrZXkMzo8UroNbQVTgMi9ned0xxRLgjKbLArgCKR_AtezVW3YUBwFI486DBo-IQQ2IDg24wsRtDaRJfbiM';

// Igreja deste deploy (multi-tenant). Usado pelas paginas publicas (sem login)
// para que a RLS consiga isolar os dados por igreja via header x-igreja-id.
const IGREJA_ID = 'b7e3f1a2-5c4d-4e6f-8a9b-1c2d3e4f5a6b';

// Igreja dona do Google Agenda (microservico GAS). Todas as demais usam a
// agenda manual (tabela 'agenda'). Como todas as igrejas usam o mesmo site,
// a igreja atual e resolvida em tempo de execucao (usuario logado ou IGREJA_ID).
const IGREJA_GOOGLE_AGENDA_ID = 'b7e3f1a2-5c4d-4e6f-8a9b-1c2d3e4f5a6b';

// Descobre a igreja atual no navegador: a do usuario logado (RPC minha_igreja)
// ou, se anonimo, o fallback do deploy (IGREJA_ID).
async function resolverIgrejaAtual(cliente) {
  try {
    const { data } = await cliente.rpc('minha_igreja');
    if (data) return data;
  } catch (e) { /* ignora */ }
  return (typeof IGREJA_ID !== 'undefined') ? IGREJA_ID : '';
}

// true somente para a igreja que usa o Google Agenda (GAS).
function usaGoogleAgenda(igrejaId) {
  return !!igrejaId && igrejaId === IGREJA_GOOGLE_AGENDA_ID;
}

// Formata 'YYYY-MM-DD' -> 'DD/MM/YYYY' (mesmo formato devolvido pelo GAS).
function formatarDataBR(iso) {
  if (!iso) return '';
  const p = String(iso).split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
}

// Converte linhas da tabela 'agenda' no mesmo formato do GAS:
// [dataBR, titulo, descricao, tipoCurto, tipoLongo]. Exibe de hoje em diante.
function agendaParaLinhas(rows) {
  const d = new Date();
  const hoje = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return (rows || [])
    .filter(a => (a.data || '') >= hoje)
    .map(a => [formatarDataBR(a.data), a.titulo, a.descricao || '', 'Agenda', 'AGENDA']);
}

// ---------------------------------------------------------------------------
// PIX da igreja (aba Oferta). A chave fica em igrejas.config->'pix' e e lida
// pela RPC 'pix_igreja' (escopada por igreja). O QR e gerado no navegador a
// partir do BR Code (payload EMV) montado com a chave cadastrada.
// ---------------------------------------------------------------------------

// Utf-8 bytes (o tamanho dos campos EMV e o CRC contam bytes, nao caracteres).
function utf8Bytes(texto) {
  const s = String(texto);
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s);
  const out = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xC0 | (c >> 6), 0x80 | (c & 0x3F));
    else out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F));
  }
  return out;
}

// Remove acentos e caracteres nao aceitos no BR Code e limita o tamanho.
function normalizarTextoEmv(texto, max) {
  return String(texto || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

// Normaliza a chave PIX: CPF/CNPJ viram apenas digitos (chave oficial do BACEN).
// E-mail, telefone (+55...) e chave aleatoria (EVP) sao mantidos como digitados.
function normalizarChavePix(chave) {
  const c = String(chave || '').trim();
  const digitos = c.replace(/\D/g, '');
  if (digitos.length === 14 && /^[\d.\-\/\s]+$/.test(c)) return digitos; // CNPJ
  if (digitos.length === 11 && /^[\d.\-\s]+$/.test(c)) return digitos; // CPF
  return c;
}

// Monta um campo EMV: id (2) + tamanho em bytes (2) + valor.
function emvCampo(id, valor) {
  const v = String(valor);
  const len = utf8Bytes(v).length;
  return id + String(len).padStart(2, '0') + v;
}

// CRC16-CCITT (0x1021) exigido pelo BR Code, calculado sobre os bytes UTF-8.
function crc16Emv(payload) {
  const bytes = utf8Bytes(payload);
  let crc = 0xFFFF;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i] << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// Gera o payload PIX "Copia e Cola" (BR Code) para a chave informada.
function pixBrCode(opts) {
  opts = opts || {};
  const chave = normalizarChavePix(opts.chave);
  if (!chave) return '';
  const nome = normalizarTextoEmv(opts.titular || 'RECEBEDOR', 25) || 'RECEBEDOR';
  const cidade = normalizarTextoEmv(opts.cidade || 'CIDADE', 15) || 'CIDADE';
  const txid = String(opts.txid || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';
  const merchant = emvCampo('00', 'br.gov.bcb.pix') + emvCampo('01', chave);
  let payload = emvCampo('00', '01')
    + emvCampo('26', merchant)
    + emvCampo('52', '0000')
    + emvCampo('53', '986')
    + emvCampo('58', 'BR')
    + emvCampo('59', nome)
    + emvCampo('60', cidade)
    + emvCampo('62', emvCampo('05', txid))
    + '6304';
  return payload + crc16Emv(payload);
}

// Desenha o QR do payload no elemento informado (usa js/vendor/qrcode.min.js).
// Gera com zona de silencio e tamanho inteiro de modulo para ficar nitido.
function gerarQRCode(texto, elemento, opts) {
  if (!elemento || !texto || typeof qrcode === 'undefined') return false;
  try {
    const qr = qrcode(0, 'M');
    qr.addData(texto);
    qr.make();
    const alvo = (opts && opts.size) || 160;
    const quiet = (opts && opts.quiet != null) ? opts.quiet : 4;
    const n = qr.getModuleCount();
    const cell = Math.max(2, Math.min(8, Math.round(alvo / (n + quiet * 2))));
    const total = cell * (n + quiet * 2);
    const url = qr.createDataURL(cell, cell * quiet);
    elemento.innerHTML = '<img alt="QR Code PIX" src="' + url + '" width="' + total + '" height="' + total
      + '" style="display:block;margin:0 auto;background:#fff;border-radius:6px;image-rendering:pixelated;">';
    return true;
  } catch (e) {
    return false;
  }
}

// Le a configuracao PIX da igreja atual (RPC). Retorna null se nao houver.
async function resolverPixIgreja(cliente) {
  try {
    const { data } = await cliente.rpc('pix_igreja');
    if (data && data.chave) {
      return { chave: data.chave, titular: data.titular || '', cidade: data.cidade || '' };
    }
  } catch (e) { /* ignora */ }
  return null;
}

// Para manter compatibilidade com código existente, também exportamos com nomes antigos
const SB_URL = SUPABASE_URL;
const supabseUrl = SUPABASE_URL;
const SB_KEY = SUPABASE_ANON_KEY;
const urlBackend = GOOGLE_SCRIPT_URL;
