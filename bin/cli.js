#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { parseArgs } = require('node:util');

const options = {
  path: { type: 'string', short: 'p' },
  output: { type: 'string', short: 'o', default: 'projeto_completo.txt' },
  filter: { type: 'string', short: 'f', multiple: true }, 
  remove: { type: 'string', short: 'r', multiple: true },
};

function limparConteudo(conteudo) {
  return conteudo
    .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '')
    .split('\n')
    .map(linha => linha.trim())
    .filter(linha => (
      linha.length > 0 && 
      !linha.startsWith('import ') && 
      !linha.startsWith('export {') &&
      !linha.startsWith('type ')
    ))
    .join(' ')
    .replace(/\s+/g, ' ');
}

try {
  const { values } = parseArgs({ options });
  
  if (!values.path) {
    console.error("❌ Erro: Informe o caminho da pasta usando --path ou -p");
    process.exit(1);
  }

  const pastaRaiz = path.resolve(values.path);
  const filtros = values.filter?.map(f => f.toLowerCase());
  // Normalizamos os termos de remoção para lowercase uma única vez
  const termosParaRemover = values.remove?.map(r => r.toLowerCase()) || [];
  const LIMIT_CHAR = 6000;
  
  let conteudoAcumulado = '';
  let contadorArquivosSaida = 1;
  const arquivosProcessadosNomes = [];

  function salvarArquivo() {
    if (conteudoAcumulado.trim().length === 0) return;
    const parsedPath = path.parse(values.output);
    const nomeComSufixo = `${parsedPath.name}_${contadorArquivosSaida}${parsedPath.ext}`;
    fs.writeFileSync(nomeComSufixo, conteudoAcumulado.trim());
    console.log(`📦 Parte ${contadorArquivosSaida} gerada: ${nomeComSufixo}`);
    conteudoAcumulado = '';
    contadorArquivosSaida++;
  }

  function varrerDiretorio(diretorio) {
    const itens = fs.readdirSync(diretorio);

    for (const item of itens) {
      const caminhoAbsoluto = path.join(diretorio, item);
      const stats = fs.statSync(caminhoAbsoluto);

      if (stats.isDirectory()) {
        if (['node_modules', 'dist', '.git', '.next', 'coverage'].includes(item)) continue;
        varrerDiretorio(caminhoAbsoluto);
      } else {
        const itemLower = item.toLowerCase();
        const ehTsValido = item.endsWith('.ts') && !item.endsWith('.spec.ts') && !item.endsWith('.test.ts');
        
        const passaFiltro = !filtros || filtros.length === 0 || filtros.some(f => itemLower.includes(f));
        
        // NOVO FILTRO -R: Verifica se o nome do arquivo contém algum dos termos (case insensitive)
        const ehRemovido = termosParaRemover.some(termo => itemLower.includes(termo));

        if (ehTsValido && passaFiltro && !ehRemovido) {
          const relativo = path.relative(pastaRaiz, caminhoAbsoluto);
          const raw = fs.readFileSync(caminhoAbsoluto, 'utf8');
          const limpo = `${limparConteudo(raw)}\n`;

          if (conteudoAcumulado.length + limpo.length > LIMIT_CHAR && conteudoAcumulado.length > 0) {
            salvarArquivo();
          }

          conteudoAcumulado += limpo;
          arquivosProcessadosNomes.push(relativo);
        }
      }
    }
  }

  console.log(`🔍 Vasculhando: ${pastaRaiz}`);
  if (filtros) console.log(`🎯 Filtros aplicados: ${filtros.join(', ')}`);
  if (termosParaRemover.length > 0) console.log(`🚫 Removendo arquivos que contenham: ${termosParaRemover.join(', ')}\n`);
  
  varrerDiretorio(pastaRaiz);
  salvarArquivo();

  console.log('\n======================================');
  if (arquivosProcessadosNomes.length > 0) {
    console.log(`✅ SUCESSO: ${arquivosProcessadosNomes.length} arquivo(s) processados:`);
    arquivosProcessadosNomes.forEach((arq, index) => {
      console.log(`${(index + 1).toString().padStart(3, ' ')}. ${arq}`);
    });
  } else {
    console.log("⚠️ Nenhum arquivo encontrado com os critérios informados.");
  }
  console.log('======================================\n');

} catch (err) {
  console.error("💥 Erro:", err.message);
}
