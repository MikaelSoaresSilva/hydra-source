const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const path = require('path');
const S = process.argv[2];
const file = 'file://' + path.join(S, 'app/index.html');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✔ ' + m); } else { fail++; console.log('  ✘ ' + m); } };

const MOCK = {
  transcricao: "Eu: e ai\nEla: oi sumido\nEla: vai na festa sábado?\nEla: o Lucas disse que vc vai",
  nome_dela: "Ana",
  leitura: { interesse: 8, clima: "leve", resumo: "Ela puxou assunto 3x.", sinais: ["mandou 3 msgs"], ganchos: ["festa"], voce_bem: "ok", voce_melhorar: "responder" },
  respostas_individuais: [
    { mensagem_dela: "oi sumido", resposta: "sumido nada kkkk tava na correria", alternativa: "eu? vc que sumiu", por_que: "leve", dica: "cite a mensagem dela" },
    { mensagem_dela: "vai na festa sábado?", resposta: "pensando em ir sim, e vc?", alternativa: "depende de quem vai kkk", por_que: "devolve" },
    { mensagem_dela: "o Lucas disse que vc vai", resposta: "o lucas fala demais kkkk", alternativa: "", por_que: "humor" }
  ],
  sugestoes: [{ texto: "kkkk tava na correria, vou sim e vc?", tipo: "leve", por_que: "responde tudo" }],
  evitar: ["textão"], proximo_passo: "marcar", musicas: [], meus_exemplos: ["e ai"], estilo_atualizado: null
};

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const reqs = [];
  await page.route('https://generativelanguage.googleapis.com/**', async route => {
    const body = JSON.parse(route.request().postData() || '{}'); reqs.push(body);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(MOCK) }] } }] }) });
  });
  // Simula dados antigos da v1.0 (sem "me") pra garantir que a atualização não quebra
  await page.addInitScript(() => {
    if (!localStorage.getItem('puxapapo')) localStorage.setItem('puxapapo', JSON.stringify({
      settings: { provider: 'gemini', keys: { gemini: 'FAKE', claude: '' }, models: { gemini: 'gemini-3.8-flash', claude: 'claude-sonnet-5-5' } },
      style: { perfil: null, exemplos: ['slk kkkk'], analises: 1 }, people: [], history: []
    }));
  });
  await page.goto(file);
  const promptOf = b => b.contents[0].parts.map(p => p.text || '').join('');
  const lastPrompt = () => promptOf(reqs[reqs.length - 1]);

  console.log('1) Abrir app (dados da v1.0)');
  ok(errors.length === 0, 'sem erros de JavaScript ' + (errors.join(' | ')));
  ok(await page.isVisible('#ctx-conversa'), 'campo Descrição visível');
  ok((await page.textContent('#s-conversa')).includes('📝 Descrição'), 'rótulo "📝 Descrição"');

  console.log('2) Sem print e sem descrição');
  await page.click('[data-run="conversa"]');
  ok((await page.textContent('#toast')).includes('Manda um print ou escreve a descrição'), 'avisa o que falta');
  ok(reqs.length === 0, 'não chamou a IA');

  console.log('3) Só descrição, várias mensagens, uma por uma');
  await page.fill('#ctx-conversa', 'Eu: e ai\nEla: oi sumido\nEla: vai na festa sábado?\nEla: o Lucas disse que vc vai');
  await page.click('[data-run="conversa"]');
  await page.waitForSelector('#out-conversa .pair');
  let p = lastPrompt();
  ok(p.includes('RESPONDER UMA POR UMA: sim') && p.includes('ainda não respondeu'), 'prompt pede uma por uma (pendentes)');
  ok(p.includes('DESCRIÇÃO ESCRITA PELO MIKAEL: Eu: e ai'), 'prompt leva a descrição');
  ok(p.includes('Sem imagem nesta análise: use a descrição'), 'prompt sabe que não há print');
  ok(reqs[0].systemInstruction.parts[0].text.includes('Leia a conversa INTEIRA'), 'sistema manda ler a conversa inteira');
  ok(reqs[0].systemInstruction.parts[0].text.includes('"respostas_individuais"'), 'formato JSON tem respostas_individuais');
  ok(await page.locator('#out-conversa .pair').count() === 3, '3 respostas, uma pra cada mensagem');
  const t1 = await page.textContent('#out-conversa .pair:nth-of-type(1)');
  ok(t1.includes('oi sumido') && t1.includes('sumido nada kkkk') && t1.includes('eu? vc que sumiu') && t1.includes('cite a mensagem'), 'card 1: mensagem dela + resposta + alternativa + dica');
  const copyAll = await page.getAttribute('[data-copy^="sumido nada"]:last-of-type', 'data-copy');
  ok(await page.locator('text=Copiar todas em ordem').count() === 1, 'botão "Copiar todas em ordem"');
  const allTxt = await page.getAttribute('text=Copiar todas em ordem', 'data-copy');
  ok(allTxt === 'sumido nada kkkk tava na correria\npensando em ir sim, e vc?\no lucas fala demais kkkk', 'copiar todas = 3 respostas na ordem');
  ok((await page.textContent('#out-conversa')).includes('Ou mande uma mensagem só'), 'sugestões viram "mensagem só"');
  ok(await page.locator('#out-conversa .pair:nth-of-type(3) .alt').count() === 0, 'sem alternativa vazia');

  console.log('4) Botão Editar numa resposta');
  await page.click('#out-conversa .pair:nth-of-type(2) [data-edit]');
  ok((await page.inputValue('#edT')) === 'pensando em ir sim, e vc?', 'editor abre com a resposta certa');
  await page.click('#modal', { position: { x: 5, y: 5 } });

  console.log('5) Refinar');
  await page.click('[data-refine="conversa|mais engraçadas"]');
  await page.waitForFunction(n => window.__n === undefined, null);
  await page.waitForTimeout(300);
  p = lastPrompt();
  ok(p.includes('MODO: REFINAR') && p.includes('refaça "respostas_individuais"') && p.includes('2. vai na festa sábado?'), 'refinar mantém uma por uma');

  console.log('6) Opção "Todas as mensagens dela"');
  await page.click('#scope-conversa .chip[data-v="todas"]');
  await page.click('[data-run="conversa"]'); await page.waitForTimeout(400);
  ok(lastPrompt().includes('CADA mensagem DELA que aparece na conversa'), 'prompt pede todas');

  console.log('7) Desligar uma por uma');
  await page.click('label.sw:has(#each-conversa)');
  ok(!(await page.isVisible('#eachOpts')), 'opções somem quando desliga');
  await page.click('[data-run="conversa"]'); await page.waitForTimeout(400);
  ok(lastPrompt().includes('RESPONDER UMA POR UMA: não pedido'), 'prompt não pede uma por uma');
  await page.click('label.sw:has(#each-conversa)');

  console.log('8) Sobre mim (descrição)');
  ok(reqs[0].contents[0].parts.map(x => x.text || '').join('').includes('Campo Limpo Paulista'), 'descrição automática vai pra IA desde a 1ª análise');
  await page.click('nav [data-tab="perfil"]');
  ok((await page.inputValue('#aboutMe')).startsWith('Mikael, 19 anos, de Campo Limpo Paulista'), 'Sobre mim já vem preenchido automaticamente');
  await page.fill('#aboutMe', ''); await page.click('#saveMe'); await page.reload(); await page.click('nav [data-tab="perfil"]');
  ok((await page.inputValue('#aboutMe')) === '', 'se ele apagar, não preenche de novo sozinho');
  await page.click('#fillMe');
  ok((await page.inputValue('#aboutMe')).includes('academia'), 'botão "Preencher automático" restaura');
  await page.fill('#aboutMe', 'tenho 19 anos, curto trap e academia');
  await page.click('#saveMe');
  await page.reload();
  await page.click('nav [data-tab="perfil"]');
  ok((await page.inputValue('#aboutMe')) === 'tenho 19 anos, curto trap e academia', 'descrição salva e volta depois de reabrir');
  ok((await page.textContent('#styleCard')).length > 0, 'tela Meu estilo ok');
  await page.click('nav [data-tab="conversa"]');
  await page.fill('#ctx-conversa', 'Ela: oi');
  await page.click('[data-run="conversa"]'); await page.waitForTimeout(400);
  ok(lastPrompt().includes('DESCRIÇÃO DO MIKAEL (escrita por ele') && lastPrompt().includes('curto trap e academia'), 'IA recebe a descrição dele');

  console.log('9) Histórico abre com as respostas uma por uma');
  await page.click('nav [data-tab="perfil"]');
  await page.click('[data-hist]');
  ok(await page.locator('#sheet .pair').count() === 3, 'histórico mostra os pares');
  await page.click('#modal', { position: { x: 5, y: 5 } });

  console.log('10) Story só com descrição');
  await page.click('nav [data-tab="story"]');
  await page.fill('#ctx-story', '3 stories: praia, treino e pôr do sol');
  await page.click('[data-run="story"]'); await page.waitForSelector('#out-story .pair');
  ok(lastPrompt().includes('uma resposta para CADA story'), 'story pede uma resposta por story');
  ok((await page.textContent('#out-story')).includes('stories'), 'contagem em stories');

  console.log('11) Com print (imagem) e limite de 10');
  await page.click('nav [data-tab="conversa"]');
  for (let i = 0; i < 2; i++) {
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('[data-pick="conversa"]')]);
    await fc.setFiles(Array(6).fill(path.join(S, 'tests/print.png')));
    await page.waitForTimeout(500);
  }
  ok(await page.locator('#th-conversa .th').count() === 10, 'guarda até 10 prints');
  await page.click('[data-run="conversa"]'); await page.waitForTimeout(500);
  const last = reqs[reqs.length - 1];
  ok(last.contents[0].parts.filter(x => x.inlineData).length === 10, 'manda os 10 prints pra IA');
  ok(lastPrompt().includes('(10 print(s) anexado(s), em ordem.)'), 'prompt sabe quantos prints');

  await page.click('nav [data-tab="conversa"]');
  await page.evaluate(() => document.querySelector('#out-conversa').scrollIntoView());
  await page.screenshot({ path: path.join(require('os').tmpdir(), 'puxapapo-shot-result.png'), fullPage: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(require('os').tmpdir(), 'puxapapo-shot-top.png') });
  ok(errors.length === 0, 'nenhum erro de JavaScript no teste todo ' + errors.join(' | '));
  console.log(`\nRESULTADO: ${pass} passaram, ${fail} falharam`);
  await browser.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
