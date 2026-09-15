// js/upload.js - Utilitarios de upload do Sistema Videira
// Compressao de imagens no navegador antes de enviar para o Storage.
(function (global) {
    var IMAGEM_MAX_LADO = 1600;
    var IMAGEM_QUALIDADE = 0.75;

    function comprimirImagem(file, opcoes) {
        var opts = opcoes || {};
        var maxLado = opts.maxLado || IMAGEM_MAX_LADO;
        var qualidade = opts.qualidade || IMAGEM_QUALIDADE;

        return new Promise(function (resolve, reject) {
            var url = URL.createObjectURL(file);
            var img = new Image();

            img.onload = function () {
                URL.revokeObjectURL(url);
                var largura = img.naturalWidth || img.width;
                var altura = img.naturalHeight || img.height;
                var maior = Math.max(largura, altura) || 1;

                if (maior > maxLado) {
                    var escala = maxLado / maior;
                    largura = Math.round(largura * escala);
                    altura = Math.round(altura * escala);
                }

                var canvas = document.createElement('canvas');
                canvas.width = largura;
                canvas.height = altura;
                var ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, largura, altura);
                ctx.drawImage(img, 0, 0, largura, altura);

                canvas.toBlob(function (blob) {
                    if (!blob) { reject(new Error('Falha ao comprimir imagem.')); return; }
                    resolve(blob);
                }, 'image/jpeg', qualidade);
            };

            img.onerror = function () {
                URL.revokeObjectURL(url);
                reject(new Error('Nao foi possivel ler a imagem.'));
            };

            img.src = url;
        });
    }

    // Retorna um File otimizado (imagem) ou o proprio PDF, ja validado por tamanho.
    function prepararArquivo(file, limites) {
        var lim = limites || {};
        var maxImagemOrigemMB = lim.maxImagemOrigemMB || 12;
        var maxImagemFinalMB = lim.maxImagemFinalMB || 3;
        var maxPdfMB = lim.maxPdfMB || 8;
        var MB = 1024 * 1024;
        var tipo = file.type || '';
        var ehPdf = tipo === 'application/pdf' || /\.pdf$/i.test(file.name);
        var ehImagem = tipo.indexOf('image/') === 0;
        var nome = (file.name || 'arquivo').replace(/\.[^.]+$/, '');

        if (ehPdf) {
            if (file.size > maxPdfMB * MB) {
                return Promise.reject(new Error('O PDF e muito grande (maximo ' + maxPdfMB + ' MB).'));
            }
            return Promise.resolve(file);
        }

        if (!ehImagem) {
            return Promise.reject(new Error('Envie uma imagem (JPG/PNG) ou um PDF.'));
        }

        if (file.size > maxImagemOrigemMB * MB) {
            return Promise.reject(new Error('A imagem e muito grande (maximo ' + maxImagemOrigemMB + ' MB).'));
        }

        return comprimirImagem(file).then(function (blob) {
            if (blob.size > maxImagemFinalMB * MB) {
                return comprimirImagem(file, { maxLado: 1200, qualidade: 0.62 }).then(function (blob2) {
                    return new File([blob2], nome + '.jpg', { type: 'image/jpeg' });
                });
            }
            return new File([blob], nome + '.jpg', { type: 'image/jpeg' });
        }).catch(function () {
            // Alguns formatos (ex.: HEIC do iPhone) nao sao decodificaveis pelo navegador
            if (file.size > maxImagemFinalMB * MB) {
                throw new Error('Nao foi possivel otimizar esta imagem. Envie em JPG/PNG.');
            }
            return file;
        });
    }

    global.VideiraUpload = {
        comprimirImagem: comprimirImagem,
        prepararArquivo: prepararArquivo
    };
})(window);
