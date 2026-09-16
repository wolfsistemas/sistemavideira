// js/pdf.js - Cabecalho/rodape padrao dos PDFs e impressoes do Sistema Videira.
// Cores padrao da igreja: roxo -> azul. Dados do cabecalho vem da RPC igreja_info
// (preenchidos no admin.html): razao social, CNPJ, endereco e pastor.
(function () {
  var ROXO = [106, 27, 154];        // #6A1B9A
  var AZUL = [21, 101, 192];        // #1565C0
  var AZUL_ESCURO = [13, 71, 161];  // #0D47A1
  var ROXO_CLARO = [237, 231, 246]; // #EDE7F6
  var AZUL_CLARO = [227, 242, 253]; // #E3F2FD
  var CINZA = [85, 85, 85];
  var CINZA_CLARO = [150, 150, 150];

  var _info = null;
  var _promessa = null;
  var _logo; // undefined = ainda nao carregado; null = indisponivel

  function getCliente(cliente) {
    if (cliente) return cliente;
    try {
      if (typeof supabase !== 'undefined' && typeof SUPABASE_URL !== 'undefined' && typeof SUPABASE_ANON_KEY !== 'undefined') {
        return supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      }
    } catch (e) { /* ignora */ }
    return null;
  }

  // Le (e memoriza) os dados da igreja. Nunca lanca: em falha retorna {}.
  async function carregarInfo(cliente) {
    if (_info) return _info;
    if (!_promessa) {
      _promessa = (async function () {
        try {
          var sb = getCliente(cliente);
          if (!sb) { _info = {}; return _info; }
          var r = await sb.rpc('igreja_info');
          _info = (r && r.data) || {};
        } catch (e) { _info = {}; }
        return _info;
      })();
    }
    return _promessa;
  }

  function definirInfo(info) {
    _info = info || {};
    _promessa = Promise.resolve(_info);
    return _info;
  }

  function nomeIgreja(info) {
    info = info || _info || {};
    return info.razao_social || 'Igreja Videira';
  }

  function nomePastor(info) {
    info = info || _info || {};
    return info.pastor_governo || info.pastor_supervisao || '';
  }

  function linhaEndereco(info) {
    info = info || _info || {};
    var partes = [];
    var rua = [info.logradouro, info.numero].filter(Boolean).join(', ');
    if (rua) partes.push(rua);
    if (info.bairro) partes.push(info.bairro);
    var cidade = [info.cidade, info.uf].filter(Boolean).join('/');
    if (cidade) partes.push(cidade);
    var linha = partes.join(' - ');
    if (!linha) linha = info.endereco || '';
    if (info.cep) linha += (linha ? ' - ' : '') + 'CEP ' + info.cep;
    return linha;
  }

  async function logoDataUrl() {
    if (_logo !== undefined) return _logo;
    try {
      var resp = await fetch('logo.png');
      var blob = await resp.blob();
      _logo = await new Promise(function (res, rej) {
        var fr = new FileReader();
        fr.onload = function () { res(fr.result); };
        fr.onerror = function () { rej(new Error('logo')); };
        fr.readAsDataURL(blob);
      });
    } catch (e) { _logo = null; }
    return _logo;
  }

  // Faixa com degrade horizontal (roxo -> azul) simulada por tiras verticais.
  function faixaGradiente(doc, x, y, w, h, c1, c2) {
    var passos = 60;
    var largura = w / passos;
    for (var i = 0; i < passos; i++) {
      var t = i / (passos - 1);
      doc.setFillColor(
        Math.round(c1[0] + (c2[0] - c1[0]) * t),
        Math.round(c1[1] + (c2[1] - c1[1]) * t),
        Math.round(c1[2] + (c2[2] - c1[2]) * t)
      );
      doc.rect(x + i * largura, y, largura + 0.4, h, 'F');
    }
  }

  // Cabecalho padrao: faixa roxo->azul com logo + nome/CNPJ/pastor/endereco e,
  // abaixo, o titulo e o subtitulo do relatorio. Retorna o Y inicial do conteudo.
  async function cabecalho(doc, titulo, subtitulo) {
    var info = await carregarInfo();
    var largura = doc.internal.pageSize.getWidth();
    var H = 30;

    faixaGradiente(doc, 0, 0, largura, H, ROXO, AZUL);

    var logo = await logoDataUrl();
    if (logo) { try { doc.addImage(logo, 'PNG', 12, 6, 18, 18); } catch (e) { /* ignora */ } }

    var x = 35;
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(nomeIgreja(info), x, 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    var linhaDois = [];
    if (info.cnpj) linhaDois.push('CNPJ: ' + info.cnpj);
    var pastor = nomePastor(info);
    if (pastor) linhaDois.push('Pastor: ' + pastor);
    if (linhaDois.length) doc.text(linhaDois.join('   |   '), x, 18);
    var endereco = linhaEndereco(info);
    if (endereco) doc.text(endereco, x, 23.5);

    doc.setFillColor(AZUL_ESCURO[0], AZUL_ESCURO[1], AZUL_ESCURO[2]);
    doc.rect(0, H, largura, 1.6, 'F');

    var y = H + 9;
    if (titulo) {
      doc.setTextColor(ROXO[0], ROXO[1], ROXO[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text(titulo, 14, y);
      y += 6;
    }
    if (subtitulo) {
      doc.setTextColor(CINZA[0], CINZA[1], CINZA[2]);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.text(subtitulo, 14, y);
      y += 6;
    }
    return y + 1;
  }

  // Rodape padrao na pagina atual do documento.
  function rodape(doc) {
    var info = _info || {};
    var largura = doc.internal.pageSize.getWidth();
    var altura = doc.internal.pageSize.getHeight();
    doc.setDrawColor(AZUL_CLARO[0], AZUL_CLARO[1], AZUL_CLARO[2]);
    doc.setLineWidth(0.4);
    doc.line(14, altura - 12, largura - 14, altura - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(CINZA_CLARO[0], CINZA_CLARO[1], CINZA_CLARO[2]);
    doc.text(nomeIgreja(info) + '  -  Sistema de Células', 14, altura - 7.5);
    doc.text('Página ' + doc.internal.getNumberOfPages(), largura - 14, altura - 7.5, { align: 'right' });
  }

  window.VideiraPDF = {
    cores: { ROXO: ROXO, AZUL: AZUL, AZUL_ESCURO: AZUL_ESCURO, ROXO_CLARO: ROXO_CLARO, AZUL_CLARO: AZUL_CLARO },
    carregarInfo: carregarInfo,
    definirInfo: definirInfo,
    nomeIgreja: nomeIgreja,
    nomePastor: nomePastor,
    linhaEndereco: linhaEndereco,
    logoDataUrl: logoDataUrl,
    cabecalho: cabecalho,
    rodape: rodape
  };
})();
