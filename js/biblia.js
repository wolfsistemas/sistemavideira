/**
 * biblia.js - Módulo unificado de Bíblia
 * Suporte a:
 *   - "A Mensagem" (arquivos separados por capítulo no GitHub)
 *   - NVI, ARA, ACF (JSON único com toda a Bíblia)
 * 
 * Uso:
 *   Inclua este script e chame Biblia.inicializar().
 *   Os selects com ids: 'biblia-versao', 'biblia-livro', 'biblia-capitulo'
 *   O conteúdo aparecerá em '#biblia-conteudo'
 */

const Biblia = (function() {
    // ---------- CONFIGURAÇÕES ----------
    const VERSOES = {
        msg: {
            nome: 'A Mensagem',
            tipo: 'capitulos',      // arquivos separados por capítulo
            baseUrl: 'https://raw.githubusercontent.com/videirajatai/sistema/refs/heads/main/biblia/'
        },
        nvi: {
            nome: 'NVI - Nova Versão Internacional',
            tipo: 'unico',
            url: 'https://raw.githubusercontent.com/videirajatai/sistema/refs/heads/main/biblias/nvi.json'
        },
        aa: {
            nome: 'ARA - Almeida Revista e Atualizada',
            tipo: 'unico',
            url: 'https://raw.githubusercontent.com/videirajatai/sistema/refs/heads/main/biblias/aa.json'
        },
        acf: {
            nome: 'ACF - Almeida Corrigida Fiel',
            tipo: 'unico',
            url: 'https://raw.githubusercontent.com/videirajatai/sistema/refs/heads/main/biblias/acf.json'
        },
        ntlh: {
            nome: 'NTLH  - Nova Trad. na Linguagem de Hoje',
            tipo: 'unico',
            url: 'https://raw.githubusercontent.com/videirajatai/sistema/refs/heads/main/biblias/ntlh.json'
        }
    };

    // Mapeamento dos livros (para "A Mensagem")
    const LIVROS_MSG = [
        { id: "genesis", nome: "Gênesis", caps: 50 }, { id: "exodo", nome: "Êxodo", caps: 40 }, { id: "levitico", nome: "Levítico", caps: 27 }, { id: "numeros", nome: "Números", caps: 36 },
        { id: "deuteronomio", nome: "Deuteronômio", caps: 34 }, { id: "josue", nome: "Josué", caps: 24 }, { id: "juizes", nome: "Juízes", caps: 21 }, { id: "rute", nome: "Rute", caps: 4 },
        { id: "1samuel", nome: "1 Samuel", caps: 31 }, { id: "2samuel", nome: "2 Samuel", caps: 24 }, { id: "1reis", nome: "1 Reis", caps: 22 }, { id: "2reis", nome: "2 Reis", caps: 25 },
        { id: "1cronicas", nome: "1 Crônicas", caps: 29 }, { id: "2cronicas", nome: "2 Crônicas", caps: 36 }, { id: "esdras", nome: "Esdras", caps: 10 }, { id: "neemias", nome: "Neemias", caps: 13 },
        { id: "ester", nome: "Ester", caps: 10 }, { id: "jo", nome: "Jó", caps: 42 }, { id: "salmos", nome: "Salmos", caps: 150 }, { id: "proverbios", nome: "Provérbios", caps: 31 },
        { id: "eclesiastes", nome: "Eclesiastes", caps: 12 }, { id: "cantares", nome: "Cantares", caps: 8 }, { id: "isaias", nome: "Isaías", caps: 66 }, { id: "jeremias", nome: "Jeremias", caps: 52 },
        { id: "lamentacoes", nome: "Lamentações", caps: 5 }, { id: "ezequiel", nome: "Ezequiel", caps: 48 }, { id: "daniel", nome: "Daniel", caps: 12 }, { id: "oseias", nome: "Oseias", caps: 14 },
        { id: "joel", nome: "Joel", caps: 3 }, { id: "amos", nome: "Amós", caps: 9 }, { id: "obadias", nome: "Obadias", caps: 1 }, { id: "jonas", nome: "Jonas", caps: 4 },
        { id: "miqueias", nome: "Miqueias", caps: 7 }, { id: "naum", nome: "Naum", caps: 3 }, { id: "habacuque", nome: "Habacuque", caps: 3 }, { id: "sofonias", nome: "Sofonias", caps: 3 },
        { id: "ageu", nome: "Ageu", caps: 2 }, { id: "zacarias", nome: "Zacarias", caps: 14 }, { id: "malaquias", nome: "Malaquias", caps: 4 }, { id: "mateus", nome: "Mateus", caps: 28 },
        { id: "marcos", nome: "Marcos", caps: 16 }, { id: "lucas", nome: "Lucas", caps: 24 }, { id: "joao", nome: "João", caps: 21 }, { id: "atos", nome: "Atos", caps: 28 },
        { id: "romanos", nome: "Romanos", caps: 16 }, { id: "1corintios", nome: "1 Coríntios", caps: 16 }, { id: "2corintios", nome: "2 Coríntios", caps: 13 }, { id: "galatas", nome: "Gálatas", caps: 6 },
        { id: "efesios", nome: "Efésios", caps: 6 }, { id: "filipenses", nome: "Filipenses", caps: 4 }, { id: "colossenses", nome: "Colossenses", caps: 4 }, { id: "1tessalonicenses", nome: "1 Tessalonicenses", caps: 5 },
        { id: "2tessalonicenses", nome: "2 Tessalonicenses", caps: 3 }, { id: "1timoteo", nome: "1 Timóteo", caps: 6 }, { id: "2timoteo", nome: "2 Timóteo", caps: 4 }, { id: "tito", nome: "Tito", caps: 3 },
        { id: "filemon", nome: "Filemom", caps: 1 }, { id: "hebreus", nome: "Hebreus", caps: 13 }, { id: "tiago", nome: "Tiago", caps: 5 }, { id: "1pedro", nome: "1 Pedro", caps: 5 },
        { id: "2pedro", nome: "2 Pedro", caps: 3 }, { id: "1joao", nome: "1 João", caps: 5 }, { id: "2joao", nome: "2 João", caps: 1 }, { id: "3joao", nome: "3 João", caps: 1 },
        { id: "judas", nome: "Judas", caps: 1 }, { id: "apocalipse", nome: "Apocalipse", caps: 22 }
    ];

    // Estado interno
    let versaoAtiva = 'msg';                      // 'msg', 'nvi', 'aa', 'acf'
    let bibliaUnica = null;                      // objeto JSON completo para versões únicas
    let listeners = [];

    // ---------- MÉTODOS PRIVADOS ----------
    function _notificar() {
        listeners.forEach(cb => cb());
    }

    async function _carregarVersaoUnica(id) {
        const info = VERSOES[id];
        if (!info || info.tipo !== 'unico') return null;
        
        // Verifica cache da sessão
        const cacheKey = `biblia_${id}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
            try {
                bibliaUnica = JSON.parse(cached);
                return bibliaUnica;
            } catch(e) {}
        }

        const resp = await fetch(info.url);
        if (!resp.ok) throw new Error(`Falha ao baixar ${info.nome}`);
        bibliaUnica = await resp.json();
        try { sessionStorage.setItem(cacheKey, JSON.stringify(bibliaUnica)); } catch(e) {}
        return bibliaUnica;
    }

    // ---------- API PÚBLICA ----------
    return {
        // Inicializa os selects e carrega a versão padrão
        async inicializar() {
            const selectVersao = document.getElementById('biblia-versao');
            const selectLivro = document.getElementById('biblia-livro');
            const selectCapitulo = document.getElementById('biblia-capitulo');

            // Preenche o select de versões
            if (selectVersao) {
                selectVersao.innerHTML = '';
                for (let [id, info] of Object.entries(VERSOES)) {
                    const opt = document.createElement('option');
                    opt.value = id;
                    opt.textContent = info.nome;
                    selectVersao.appendChild(opt);
                }
                selectVersao.value = versaoAtiva;
                selectVersao.addEventListener('change', () => this.mudarVersao(selectVersao.value));
            }

            // Carrega a versão inicial
            await this.mudarVersao(versaoAtiva);
        },

        async mudarVersao(novaVersao) {
            versaoAtiva = novaVersao;
            localStorage.setItem('biblia_versao', novaVersao);

            const selectLivro = document.getElementById('biblia-livro');
            const selectCapitulo = document.getElementById('biblia-capitulo');
            const info = VERSOES[novaVersao];

            if (!info) return;

            if (info.tipo === 'capitulos') {
                // "A Mensagem" - livros fixos
                bibliaUnica = null;
                selectLivro.innerHTML = '';
                LIVROS_MSG.forEach(l => {
                    const opt = document.createElement('option');
                    opt.value = l.id;
                    opt.textContent = l.nome;
                    selectLivro.appendChild(opt);
                });
                // Restaura último livro/capítulo
                const ultimoLivro = localStorage.getItem('biblia_livro_msg') || 'genesis';
                selectLivro.value = ultimoLivro;
                this.atualizarCapitulosMsg();
            } else {
                // Versão única (NVI, ARA, ACF)
                selectLivro.innerHTML = '<option>Carregando...</option>';
                selectCapitulo.innerHTML = '<option>—</option>';
                try {
                    await _carregarVersaoUnica(novaVersao);
                    if (!bibliaUnica) throw new Error('Dados não carregados');
                    
                    // Preenche livros
                    selectLivro.innerHTML = '';
                    bibliaUnica.forEach(livro => {
                        const opt = document.createElement('option');
                        opt.value = livro.abbrev;
                        opt.textContent = livro.name;
                        selectLivro.appendChild(opt);
                    });

                    // Restaura último livro/capítulo
                    const ultimoLivro = localStorage.getItem(`biblia_livro_${novaVersao}`) || bibliaUnica[0].abbrev;
                    selectLivro.value = ultimoLivro;
                    this.atualizarCapitulosUnico();
                } catch (e) {
                    console.error(e);
                    selectLivro.innerHTML = '<option>Erro ao carregar</option>';
                }
            }
            _notificar();
        },

        // Atualiza capítulos para "A Mensagem"
        atualizarCapitulosMsg() {
            const selectLivro = document.getElementById('biblia-livro');
            const selectCapitulo = document.getElementById('biblia-capitulo');
            const livroId = selectLivro.value;
            const livro = LIVROS_MSG.find(l => l.id === livroId);
            if (!livro) return;

            localStorage.setItem('biblia_livro_msg', livroId);
            let html = '';
            for (let i = 1; i <= livro.caps; i++) {
                html += `<option value="${i}">Capítulo ${i}</option>`;
            }
            selectCapitulo.innerHTML = html;
            const ultimoCap = localStorage.getItem(`biblia_cap_msg_${livroId}`) || '1';
            selectCapitulo.value = ultimoCap;
            this.carregarCapitulo();
        },

        // Atualiza capítulos para versão única
        atualizarCapitulosUnico() {
            const selectLivro = document.getElementById('biblia-livro');
            const selectCapitulo = document.getElementById('biblia-capitulo');
            const abrev = selectLivro.value;
            if (!bibliaUnica) return;

            const livro = bibliaUnica.find(l => l.abbrev === abrev);
            if (!livro) return;

            localStorage.setItem(`biblia_livro_${versaoAtiva}`, abrev);
            const numCaps = livro.chapters.length;
            let html = '';
            for (let i = 1; i <= numCaps; i++) {
                html += `<option value="${i}">Capítulo ${i}</option>`;
            }
            selectCapitulo.innerHTML = html;
            const ultimoCap = localStorage.getItem(`biblia_cap_${versaoAtiva}_${abrev}`) || '1';
            selectCapitulo.value = ultimoCap;
            this.carregarCapitulo();
        },

        // Carrega o capítulo atual (funciona para ambas)
        async carregarCapitulo() {
            const selectLivro = document.getElementById('biblia-livro');
            const selectCapitulo = document.getElementById('biblia-capitulo');
            const conteudo = document.getElementById('biblia-conteudo');
            const livroId = selectLivro.value;
            const cap = selectCapitulo.value;
            const nomeLivro = selectLivro.options[selectLivro.selectedIndex]?.text || '';

            conteudo.innerHTML = `<p class='biblia-placeholder'><i class='fas fa-spinner fa-spin'></i> Carregando...</p>`;

            try {
                if (versaoAtiva === 'msg') {
                    // Carrega do GitHub (arquivos separados)
                    const url = `${VERSOES.msg.baseUrl}/${livroId}/${cap}.json`;
                    const resp = await fetch(url);
                    if (!resp.ok) throw new Error('Capítulo não encontrado');
                    const versiculos = await resp.json();

                    let html = `<h3 style="color: var(--ouro-videira); margin-bottom: 25px;">${nomeLivro} ${cap}</h3>`;
                    versiculos.forEach(v => {
                        html += `<div style="margin-bottom: 15px;">`;
                        if (v.title) html += `<h4 style="color: #475569; font-size: 0.95rem; margin-top: 25px; margin-bottom: 10px;">${v.title}</h4>`;
                        html += `<p style="margin:0; text-align:justify;"><sup style="color:var(--ouro-videira); font-weight:bold; margin-right:4px;">${v.number}</sup>${v.content}</p></div>`;
                    });
                    conteudo.innerHTML = html;
                    localStorage.setItem(`biblia_cap_msg_${livroId}`, cap);
                } else {
                    // Versão única
                    if (!bibliaUnica) await _carregarVersaoUnica(versaoAtiva);
                    const livro = bibliaUnica.find(l => l.abbrev === livroId);
                    if (!livro) throw new Error('Livro não encontrado');
                    const versiculos = livro.chapters[parseInt(cap)-1] || [];
                    
                    let html = `<h3 style="color: var(--ouro-videira); margin-bottom: 25px;">${livro.name} ${cap}</h3>`;
                    versiculos.forEach((texto, idx) => {
                        html += `<p style="margin:0 0 12px; text-align:justify;"><sup style="color:var(--ouro-videira); font-weight:bold; margin-right:6px;">${idx+1}</sup>${texto}</p>`;
                    });
                    conteudo.innerHTML = html;
                    localStorage.setItem(`biblia_cap_${versaoAtiva}_${livroId}`, cap);
                }
            } catch (e) {
                conteudo.innerHTML = `<p style="color:#dc3545;"><i class="fas fa-exclamation-triangle"></i> Erro ao carregar.</p>`;
                console.error(e);
            }
        },

        // Handler para eventos dos selects (você pode chamar diretamente do HTML)
        onLivroChange() {
            if (versaoAtiva === 'msg') {
                this.atualizarCapitulosMsg();
            } else {
                this.atualizarCapitulosUnico();
            }
        },

        onCapituloChange() {
            this.carregarCapitulo();
        },

        getVersaoAtiva() { return versaoAtiva; }
    };
})();
