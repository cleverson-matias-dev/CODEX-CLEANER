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
  const nomesParaRemover = values.remove || [];
  const LIMIT_CHAR = 6000;
  
  let conteudoAcumulado = '';
  let contadorArquivosSaida = 1;
  const arquivosProcessadosNomes = []; // Lista para o log final

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
        const ehTsValido = item.endsWith('.ts') && !item.endsWith('.spec.ts') && !item.endsWith('.test.ts');
        const passaFiltro = !filtros || filtros.length === 0 || filtros.some(f => item.toLowerCase().includes(f));
        const ehRemovido = nomesParaRemover.includes(item);

        if (ehTsValido && passaFiltro && !ehRemovido) {
          const relativo = path.relative(pastaRaiz, caminhoAbsoluto);
          const raw = fs.readFileSync(caminhoAbsoluto, 'utf8');
          const limpo = `${limparConteudo(raw)}\n`;

          if (conteudoAcumulado.length + limpo.length > LIMIT_CHAR && conteudoAcumulado.length > 0) {
            salvarArquivo();
          }

          conteudoAcumulado += limpo;
          // Adiciona o caminho relativo à lista de sucesso
          arquivosProcessadosNomes.push(relativo);
        }
      }
    }
  }

  console.log(`🔍 Vasculhando: ${pastaRaiz}`);
  if (filtros) console.log(`🎯 Filtros aplicados: ${filtros.join(', ')}\n`);
  
  varrerDiretorio(pastaRaiz);
  salvarArquivo();

  // EXIBIÇÃO DA LISTA E QUANTIDADE
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
