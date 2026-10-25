const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const path = require('path');
const S = process.argv[2];
const file = 'file://' + path.join(S, 'app/index.html');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✔ ' + m); } else { fail++; console.log('  ✘ ' + m); } };

const MOCK = {
  transcricao: "Eu: e ai\nEla: oi sumido\nEla: vai na festa sábado?\nEla: o Lucas disse que vc vai",
  nome_dela: "Ana",
  leitura: { interesse: 8, clima: "leve", resumo: "Ela puxou assunto 3x.", sinais: ["mandou 3 msgs"], ganchos: ["festa"], voce_bem: "ok", voce_melhorar: "responder", alertas: ["chantagem de culpa → 'entendo, e mesmo assim minha resposta é não'"] },
  respostas_individuais: [
    { mensagem_dela: "oi sumido", resposta: "sumido nada kkkk tava na correria", alternativa: "eu? vc que sumiu", por_que: "leve", dica: "cite a mensagem dela", tecnica: "Auditoria de acusações · Chris Voss" },
    { mensagem_dela: "vai na festa sábado?", resposta: "pensando em ir sim, e vc?", alternativa: "depende de quem vai kkk", por_que: "devolve" },
    { mensagem_dela: "o Lucas disse que vc vai", resposta: "o lucas fala demais kkkk", alternativa: "", por_que: "humor" }
  ],
  sugestoes: [{ texto: "kkkk tava na correria, vou sim e vc?", tipo: "leve", por_que: "responde tudo", tecnica: "Escada do Sim · Cialdini" }],
  dica_manual: "Diga menos que o necessário: mensagem curta e segura.",
  evitar: ["textão"], proximo_passo: "marcar", musicas: [], meus_exemplos: ["e ai"], estilo_atualizado: null
};

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const reqs = [], calls = [];
  const srv = { busy: new Set(), status: 503, delay: {} };
  const MODELS = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.5-pro'];
  await page.route('https://generativelanguage.googleapis.com/**', async route => {
    const req = route.request();
    if (req.method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ models: MODELS.map(m => ({ name: 'models/' + m, supportedGenerationMethods: ['generateContent'] })) }) });
    const model = decodeURIComponent(req.url().split('/models/')[1].split(':')[0]);
    const body = JSON.parse(req.postData() || '{}'); calls.push(model);
    if (srv.delay[model]) await new Promise(r => setTimeout(r, srv.delay[model]));
    if (srv.busy.has(model)) return route.fulfill({ status: srv.status, contentType: 'application/json', body: JSON.stringify({ error: { code: srv.status, message: 'The model is overloaded. Please try again later.' } }) });
    reqs.push(body);
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
  const clickAI = async sel => { const n = reqs.length; await page.click(sel); for (let i = 0; i < 200 && reqs.length === n; i++) await page.waitForTimeout(50); await page.waitForTimeout(100); };
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
  await clickAI('[data-refine="conversa|mais engraçadas"]');
  p = lastPrompt();
  ok(p.includes('MODO: REFINAR') && p.includes('refaça "respostas_individuais"') && p.includes('2. vai na festa sábado?'), 'refinar mantém uma por uma');

  console.log('6) Opção "Todas as mensagens dela"');
  await page.click('#scope-conversa .chip[data-v="todas"]');
  await clickAI('[data-run="conversa"]');
  ok(lastPrompt().includes('CADA mensagem DELA que aparece na conversa'), 'prompt pede todas');

  console.log('7) Desligar uma por uma');
  await page.click('label.sw:has(#each-conversa)');
  ok(!(await page.isVisible('#eachOpts')), 'opções somem quando desliga');
  await clickAI('[data-run="conversa"]');
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
  await clickAI('[data-run="conversa"]');
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
    await page.waitForFunction(n => document.querySelectorAll('#th-conversa .th').length >= n, Math.min(10, 6 * (i + 1)));
  }
  ok(await page.locator('#th-conversa .th').count() === 10, 'guarda até 10 prints');
  await clickAI('[data-run="conversa"]');
  const last = reqs[reqs.length - 1];
  ok(last.contents[0].parts.filter(x => x.inlineData).length === 10, 'manda os 10 prints pra IA');
  ok(lastPrompt().includes('(10 print(s) anexado(s), em ordem.)'), 'prompt sabe quantos prints');

  console.log('12) Servidor lotado (503): troca sozinho');
  await page.evaluate(() => { const d = JSON.parse(localStorage.puxapapo); delete d.settings.good; localStorage.puxapapo = JSON.stringify(d); });
  await page.reload();
  await page.fill('#ctx-conversa', 'Ela: oi\nEla: tudo bem?');
  srv.busy = new Set(['gemini-3.8-flash']); calls.length = 0;
  const seen = [];
  const poll = setInterval(async () => { try { const t = await page.textContent('#ld-conversa .ldt'); if (t && !seen.includes(t)) seen.push(t); } catch (e) {} }, 100);
  await page.click('[data-run="conversa"]');
  await page.waitForSelector('#out-conversa .pair', { timeout: 20000 });
  clearInterval(poll);
  ok(calls.join(',') === 'gemini-3.8-flash,gemini-3.8-flash,gemini-3.6-flash', 'tentou de novo no lotado e trocou pro próximo: ' + calls.join(','));
  ok(seen.some(t => t.includes('Servidor lotado, tentando outro')), 'mostra "Servidor lotado, tentando outro..."');
  ok((await page.textContent('#toast')).includes('Usei gemini-3.6-flash'), 'avisa qual servidor usou');
  ok(await page.locator('#out-conversa .err').count() === 0, 'sem mensagem de erro');
  calls.length = 0;
  await page.click('[data-run="conversa"]'); await page.waitForSelector('#out-conversa .pair', { timeout: 20000 });
  ok(calls[0] === 'gemini-3.6-flash', 'próxima análise já começa no servidor que funcionou');

  console.log('13) Todos lotados');
  srv.busy = new Set(MODELS); calls.length = 0;
  await page.click('[data-run="conversa"]');
  await page.waitForSelector('#out-conversa .err', { timeout: 40000 });
  const errTxt = await page.textContent('#out-conversa .err');
  ok(errTxt.includes('lotado') && errTxt.includes('Tentei'), 'erro claro depois de tentar vários: ' + errTxt.replace(/\n/g, ' '));
  ok(new Set(calls).size >= 4, 'tentou ' + new Set(calls).size + ' servidores diferentes');

  console.log('14) Limite (429) num modelo: pula sem repetir');
  srv.busy = new Set(['gemini-3.6-flash']); srv.status = 429; calls.length = 0;
  await page.click('[data-run="conversa"]'); await page.waitForSelector('#out-conversa .pair', { timeout: 20000 });
  ok(calls.join(',') === 'gemini-3.6-flash,gemini-3.8-flash', '429 pula direto pro próximo: ' + calls.join(','));

  console.log('15) Chave errada (401): não fica tentando');
  srv.busy = new Set(MODELS); srv.status = 401; calls.length = 0;
  await page.click('[data-run="conversa"]'); await page.waitForSelector('#out-conversa .err', { timeout: 20000 });
  ok(calls.length === 1 && (await page.textContent('#out-conversa .err')).includes('Chave recusada'), 'para na 1ª tentativa e fala da chave');

  console.log('16) Troca automática desligada');
  srv.busy = new Set(['gemini-3.8-flash']); srv.status = 503;
  await page.evaluate(() => { const d = JSON.parse(localStorage.puxapapo); delete d.settings.good; localStorage.puxapapo = JSON.stringify(d); });
  await page.reload();
  await page.click('nav [data-tab="ajustes"]');
  ok(await page.isChecked('#autoSrv'), 'troca automática vem ligada');
  await page.click('label.sw:has(#autoSrv)');
  await page.click('nav [data-tab="conversa"]'); await page.fill('#ctx-conversa', 'Ela: oi'); calls.length = 0;
  await page.click('[data-run="conversa"]'); await page.waitForSelector('#out-conversa .err', { timeout: 20000 });
  ok(calls.length === 1, 'desligada: tenta só o escolhido');
  await page.click('nav [data-tab="ajustes"]'); await page.click('label.sw:has(#autoSrv)');

  console.log('17) Procurar o melhor servidor');
  srv.busy = new Set(['gemini-3.8-flash']); srv.status = 503;
  srv.delay = { 'gemini-3.6-flash': 900, 'gemini-3.5-flash-lite': 150, 'gemini-3.1-flash-lite': 600, 'gemini-3.5-pro': 1200 };
  await page.click('#bestSrv');
  await page.waitForSelector('#srvMsg ul', { timeout: 20000 });
  const sm = await page.textContent('#srvMsg');
  ok(sm.includes('Escolhido: gemini-3.5-flash-lite'), 'escolheu o mais rápido que respondeu');
  ok(/❌ gemini-3.8-flash\s*lotado/.test(sm), 'mostra o lotado com ❌');
  ok((await page.inputValue('#model')) === 'gemini-3.5-flash-lite', 'modelo selecionado atualizado');
  srv.busy = new Set(); srv.delay = {};

  console.log('18) Manual do Assassino');
  await page.click('nav [data-tab="conversa"]');
  await page.fill('#ctx-conversa', 'Ela: oi\nEla: tudo bem?');
  await page.click('[data-run="conversa"]'); await page.waitForSelector('#out-conversa .pair', { timeout: 20000 });
  let sys = reqs[reqs.length - 1].systemInstruction.parts[0].text;
  ok(sys.includes('MANUAL DO ASSASSINO') && sys.includes('Espelhamento') && sys.includes('Escada do Sim') && sys.includes('Teste do jornal'), 'IA recebe o conhecimento do Manual');
  ok(sys.includes('PROIBIDO') && sys.includes('Bombardeio de amor') && sys.includes('só pra ALERTAR'), 'táticas sujas só como alerta');
  ok(sys.includes('"tecnica"') && sys.includes('"dica_manual"') && sys.includes('"alertas"'), 'formato pede técnica, alerta e lição');
  const out = await page.textContent('#out-conversa');
  ok(out.includes('📚 Escada do Sim · Cialdini'), 'sugestão mostra a técnica usada');
  ok(out.includes('📚 Auditoria de acusações · Chris Voss'), 'resposta uma por uma mostra a técnica');
  ok(out.includes('🛡️ Sinal de alerta') && out.includes('chantagem de culpa'), 'mostra alerta de manipulação dela');
  ok(out.includes('📚 Lição do Manual') && out.includes('Diga menos'), 'mostra a lição do Manual');
  ok(await page.locator('#goal-conversa .chip').filter({ hasText: 'Ela tá chateada' }).count() === 1 && await page.locator('#goal-conversa .chip').filter({ hasText: 'Consertar mancada' }).count() === 1 && await page.locator('#goal-conversa .chip').filter({ hasText: 'Ela disse não' }).count() === 1, 'novos objetivos do Manual');
  await page.click('#goal-conversa .chip:has-text("Ela tá chateada")');
  await clickAI('[data-run="conversa"]');
  ok(lastPrompt().includes('rotulagem de Chris Voss'), 'objetivo "Ela tá chateada" chega na IA');
  await clickAI('[data-refine="conversa|usando mais o Manual"]');
  ok(lastPrompt().includes('PEDIDO DO MIKAEL: usando mais o Manual'), 'refinar "usando mais o Manual"');
  await page.click('nav [data-tab="ajustes"]');
  ok(await page.isChecked('#useManual'), 'Manual vem ligado');
  await page.click('label.sw:has(#useManual)');
  await page.click('nav [data-tab="conversa"]'); await clickAI('[data-run="conversa"]');
  sys = reqs[reqs.length - 1].systemInstruction.parts[0].text;
  ok(!sys.includes('MANUAL DO ASSASSINO') && sys.includes('Puxa Papo'), 'desligado: IA não recebe o Manual');
  await page.click('nav [data-tab="ajustes"]'); await page.click('label.sw:has(#useManual)');

  await page.click('nav [data-tab="conversa"]');
  await page.evaluate(() => document.querySelector('#out-conversa').scrollIntoView());
  await page.screenshot({ path: path.join(require('os').tmpdir(), 'puxapapo-shot-result.png'), fullPage: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(require('os').tmpdir(), 'puxapapo-shot-top.png') });
  ok(errors.length === 0, 'nenhum erro de JavaScript no teste todo ' + errors.join(' | '));
  console.log(`\nRESULTADO: ${pass} passaram, ${fail} falharam`);
  await browser.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
