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

// Para manter compatibilidade com código existente, também exportamos com nomes antigos
const SB_URL = SUPABASE_URL;
const supabseUrl = SUPABASE_URL;
const SB_KEY = SUPABASE_ANON_KEY;
const urlBackend = GOOGLE_SCRIPT_URL;
