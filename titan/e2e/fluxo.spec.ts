import { expect, test } from '@playwright/test';

// Fluxo completo em modo local (build sem chaves do Supabase).
test('onboarding → treino com séries → persistência → nutrição → pele → medidas', async ({ page }, info) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Usar em modo local' }).click();

  // Onboarding
  await expect(page.getByRole('heading', { name: 'Você' })).toBeVisible();
  await page.getByRole('button', { name: 'Salvar e continuar' }).click();
  await expect(page.getByRole('alert')).toContainText('Confirme');
  await page.getByLabel('Confirmo que estes dados estão atuais.').check();
  await page.getByRole('button', { name: 'Salvar e continuar' }).click();
  await expect(page.getByRole('heading', { name: 'Treino', exact: true })).toBeVisible();
  await page.getByLabel(/Conferi a lista/).check();
  await page.getByRole('button', { name: 'Salvar e continuar' }).click(); // treino
  await page.getByRole('button', { name: 'Pular' }).click(); // nutrição (pulada: mantém padrões já salvos)
  await page.getByRole('button', { name: 'Principia GL-02' }).click();
  await page.getByRole('button', { name: 'Salvar e continuar' }).click(); // pele
  await page.getByRole('button', { name: 'Salvar e continuar' }).click(); // cabelo
  await page.getByRole('button', { name: 'Gerar meu plano' }).click();

  // Painel diário
  await expect(page.getByRole('heading', { name: 'O que fazer hoje' })).toBeVisible();
  await page.screenshot({ path: `test-results/hoje-${info.project.name}.png`, fullPage: true });

  // Treino
  await page.getByRole('link', { name: 'Treino' }).first().click();
  await expect(page.getByText(/Próxima sessão:/)).toBeVisible();
  await expect(page.getByText(/^Protocolo JKK — 4 dias · início/)).toBeVisible();
  await expect(page.getByText('Próxima sessão: Dia 1 · Superior A — Peito superior + Costas (largura) + Ombro + Tríceps')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Revisões automáticas' })).toBeVisible();
  await expect(page.getByText('Supino inclinado com halteres (30°)').first()).toBeVisible();
  await expect(page.getByRole('radio', { name: /4 dias/ })).toHaveAttribute('aria-checked', 'true');
  // Conteúdo do protocolo fica recolhido em "Sobre o protocolo"
  await page.getByText('Sobre o protocolo (avaliação, regras, flancos e fontes)').click();
  await expect(page.getByText('Por que 4 dias dá o mesmo resultado (ou melhor)')).toBeVisible();
  await expect(page.getByText('FLANCOS: O QUE FUNCIONA DE VERDADE')).toBeVisible();
  await page.getByRole('button', { name: 'Iniciar treino' }).click();
  // Protocolo JKK: séries, faixas e orientações exatamente como no documento
  await expect(page.getByRole('heading', { name: 'Supino inclinado com halteres (30°)' })).toBeVisible();
  await expect(page.getByText(/4 × 6–10 · descanso 2–3 min/)).toBeVisible();
  // Plano fechado: sem trocar livremente nem somar séries
  await expect(page.getByRole('button', { name: 'Trocar', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '+ série' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Aparelho indisponível' }).first()).toBeVisible();
  await page.getByLabel('Carga série 1').first().fill('60');
  await page.getByLabel('Repetições série 1').first().fill('8');
  await page.getByLabel('RIR série 1').first().fill('3');
  await page.getByRole('button', { name: 'Concluir série 1' }).first().click();
  await expect(page.getByRole('timer')).toBeVisible();
  await expect(page.getByText(/Série 1: 8 reps com RIR 3: dentro do alvo/)).toBeVisible();
  // Série 2 fácil demais → a carga da série seguinte sobe sozinha
  await page.getByRole('button', { name: 'Pular' }).click();
  await page.getByLabel('Repetições série 2').first().fill('15');
  await page.getByLabel('RIR série 2').first().fill('5');
  await page.getByRole('button', { name: 'Concluir série 2' }).first().click();
  await expect(page.getByText(/Série 2: 15 reps com RIR 5: acima do alvo. Próxima série: /)).toBeVisible();
  await expect(page.getByLabel('Carga série 3').first()).not.toHaveValue('60');
  await page.screenshot({ path: `test-results/treino-${info.project.name}.png` });

  // Recarrega: série continua salva
  await page.reload();
  await expect(page.getByRole('button', { name: 'Concluir série 1' }).first()).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Carga série 1').first()).toHaveValue('60');
  await expect(page.getByRole('heading', { name: 'O que muda no próximo treino' })).toBeVisible();
  await page.screenshot({ path: `test-results/progressao-${info.project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Concluir treino' }).click();
  await expect(page.getByText('Treino concluído e salvo!')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ver' }).first()).toBeVisible();

  // Nutrição: meta calculada a partir do perfil (80 kg, 180 cm, 19 anos, moderado → 3000 kcal)
  await page.getByRole('link', { name: 'Nutrição' }).first().click();
  await page.getByRole('tab', { name: 'Metas' }).click();
  await expect(page.locator('.stat-v').first()).toHaveText('3000');
  await page.getByRole('tab', { name: 'Plano' }).click();
  await page.getByRole('button', { name: 'Comi isso' }).first().click();
  await page.getByRole('tab', { name: 'Hoje' }).click();
  await expect(page.getByText('Registrado hoje')).toBeVisible();
  await expect(page.locator('.list li').filter({ hasText: 'Café da manhã' }).first()).toBeVisible();

  // Pele: gerar e editar rotina; produto do onboarding aparece como pausado
  await page.getByRole('link', { name: 'Cuidados' }).first().click();
  await page.getByRole('button', { name: 'Gerar rotina base' }).click();
  await expect(page.getByRole('heading', { name: 'Manhã' }).first()).toBeVisible();
  await expect(page.locator('li strong', { hasText: 'Principia GL-02' })).toBeVisible();
  await page.getByRole('button', { name: 'Editar' }).last().click();
  await page.getByLabel('Passo').fill('Hidratante gel leve');
  await page.getByRole('button', { name: 'Salvar' }).first().click();
  await expect(page.getByText('Hidratante gel leve').first()).toBeVisible();

  // Evolução: medidas + gráfico com dado real
  await page.getByRole('link', { name: 'Evolução' }).first().click();
  await page.getByLabel('Peso (kg)').fill('80,4');
  await page.getByLabel('Braço direito contraído (cm)').fill('38,5');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('cell', { name: '80,4' })).toBeVisible();
  // Ao salvar medidas, o app reavalia o treino de 4 dias (1ª medição = linha de base: nada muda)
  await expect(page.getByRole('heading', { name: /Avaliação do treino/ })).toBeVisible();
  await expect(page.getByText('Nenhuma troca necessária.')).toBeVisible();
  await expect(page.getByText(/linha de base/).first()).toBeVisible();
  await page.getByRole('tab', { name: 'Gráficos' }).click();
  await expect(page.locator('.recharts-surface').first()).toBeVisible();

  // Proporções aparecem no Treino a partir da medição
  await page.goto('/#/treino');
  await expect(page.getByRole('cell', { name: 'Braço / cintura' })).toHaveCount(0); // sem cintura medida ainda
  await page.screenshot({ path: `test-results/olympia-${info.project.name}.png`, fullPage: true });

  // Persistência após "sair e entrar" (nova página, mesmo navegador)
  await page.goto('/#/treino');
  await expect(page.getByRole('link', { name: 'Ver' }).first()).toBeVisible();
  await page.screenshot({ path: `test-results/evolucao-${info.project.name}.png`, fullPage: true });
});

test('aparência (questionário sem IA) + biblioteca/calculadora + IA desligada por padrão', async ({ page }, info) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Usar em modo local' }).click();
  await page.getByLabel('Confirmo que estes dados estão atuais.').check();
  await page.getByRole('button', { name: 'Salvar e continuar' }).click();
  await page.getByLabel(/Conferi a lista/).check();
  await page.getByRole('button', { name: 'Salvar e continuar' }).click();
  await page.getByRole('button', { name: 'Pular' }).click();
  await page.getByRole('button', { name: 'Salvar e continuar' }).click();
  await page.getByRole('button', { name: 'Salvar e continuar' }).click();
  await page.getByRole('button', { name: 'Gerar meu plano' }).click();
  await expect(page.getByRole('heading', { name: 'O que fazer hoje' })).toBeVisible();

  await page.getByRole('link', { name: 'Aparência' }).click();
  // Plano do rosto é a primeira aba: treino facial marcado conta na Missão
  await expect(page.getByRole('heading', { name: '2. Treino facial (5–6 min por dia)' })).toBeVisible();
  await page.getByRole('button', { name: 'Marcar treino facial de hoje' }).click();
  await expect(page.getByRole('button', { name: /Feito hoje/ })).toBeVisible();
  await page.getByRole('tab', { name: 'Corte' }).click();
  await page.getByLabel('length').selectOption('similar');
  await page.getByLabel('widest').selectOption('equal');
  await page.getByLabel('jaw').selectOption('angular');
  await expect(page.getByRole('heading', { name: 'Rosto quadrado' })).toBeVisible();
  await expect(page.getByText('Assimétrico com pontas desiguais puxadas para a testa').first()).toBeVisible();
  await page.getByRole('button', { name: 'Salvar no histórico' }).click();
  await page.getByRole('tab', { name: 'Histórico' }).click();
  await expect(page.getByText('Rosto: quadrado')).toBeVisible();
  await page.screenshot({ path: `test-results/aparencia-${info.project.name}.png`, fullPage: true });

  // IA desligada por padrão: nada é enviado sem ligar e consentir
  await page.getByRole('tab', { name: 'Foto + IA' }).click();
  await expect(page.getByText('Análise por foto com IA (desligada)')).toBeVisible();
  await page.getByRole('button', { name: 'Ligar análise por IA' }).click();
  await expect(page.getByRole('button', { name: 'Enviar e analisar' })).toBeDisabled();

  // Biblioteca: calculadora de 1RM
  await page.goto('/#/biblioteca');
  await page.getByRole('tab', { name: 'Calculadora' }).click();
  await page.getByLabel('Carga da série').fill('60');
  await page.getByLabel('Repetições feitas').fill('10');
  await expect(page.getByTestId('e1rm')).toHaveText('80 kg');
  await page.getByRole('tab', { name: 'Sistemas' }).click();
  await expect(page.getByText('Drop-set')).toBeVisible();
  await page.screenshot({ path: `test-results/biblioteca-${info.project.name}.png`, fullPage: true });
});

test('missão: começar, marcar hábito e ver o progresso no painel', async ({ page }, info) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Usar em modo local' }).click();
  await page.getByLabel('Confirmo que estes dados estão atuais.').check();
  await page.getByRole('button', { name: 'Salvar e continuar' }).click();
  await page.getByLabel(/Conferi a lista/).check();
  await page.getByRole('button', { name: 'Salvar e continuar' }).click();
  await page.getByRole('button', { name: 'Pular' }).click();
  await page.getByRole('button', { name: 'Salvar e continuar' }).click();
  await page.getByRole('button', { name: 'Salvar e continuar' }).click();
  await page.getByRole('button', { name: 'Gerar meu plano' }).click();

  await page.getByRole('link', { name: 'Ver a missão' }).click();
  await page.getByRole('button', { name: 'Começar hoje' }).click();
  await expect(page.getByText(/Semana 1 de 12/)).toBeVisible();
  const before = await page.locator('.card').filter({ hasText: 'Hoje' }).first().locator('strong').first().innerText();
  await page.getByLabel('Dentes: escovar 2× + fio dental').check();
  await expect(page.getByLabel('Dentes: escovar 2× + fio dental')).toBeChecked();
  const after = await page.locator('.card').filter({ hasText: 'Hoje' }).first().locator('strong').first().innerText();
  expect(Number(after.split('/')[0])).toBe(Number(before.split('/')[0]) + 1);
  await page.reload();
  await expect(page.getByLabel('Dentes: escovar 2× + fio dental')).toBeChecked();
  await page.screenshot({ path: `test-results/missao-${info.project.name}.png`, fullPage: true });
  await page.getByRole('link', { name: 'Hoje' }).first().click();
  await expect(page.getByRole('heading', { name: 'Missão de hoje' })).toBeVisible();
});

test('fotos: escolher várias da galeria de uma vez', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Usar em modo local' }).click();
  await page.getByLabel('Confirmo que estes dados estão atuais.').check();
  await page.getByRole('button', { name: 'Salvar e continuar' }).click();
  await page.getByLabel(/Conferi a lista/).check();
  await page.getByRole('button', { name: 'Salvar e continuar' }).click();
  await page.getByRole('button', { name: 'Pular' }).click();
  await page.getByRole('button', { name: 'Salvar e continuar' }).click();
  await page.getByRole('button', { name: 'Salvar e continuar' }).click();
  await page.getByRole('button', { name: 'Gerar meu plano' }).click();
  await page.getByRole('link', { name: 'Evolução' }).first().click();
  await page.getByRole('tab', { name: 'Fotos' }).click();
  // PNG 1×1 gerado no teste (nenhuma foto real no repositório)
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await page.getByLabel('Escolher fotos').setInputFiles([
    { name: 'a.png', mimeType: 'image/png', buffer: png },
    { name: 'b.png', mimeType: 'image/png', buffer: png },
  ]);
  await expect(page.locator('.photo-grid img')).toHaveCount(2);
});

test('bipe do descanso: botão "Testar som" toca o bipe alto no navegador real', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __beeps: (number | string)[] };
    w.__beeps = [];
    const orig = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function (this: AudioContext) {
      const o = orig.call(this);
      const start = o.start.bind(o);
      o.start = (when?: number) => { w.__beeps.push(o.frequency.value); start(when); };
      return o;
    };
    const origBuf = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function (this: AudioContext) {
      const b = origBuf.call(this);
      const start = b.start.bind(b);
      b.start = (...a: number[]) => { w.__beeps.push(`arquivo:${b.buffer?.duration.toFixed(2)}`); start(...a); };
      return b;
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Usar em modo local' }).click();
  await page.getByLabel('Confirmo que estes dados estão atuais.').check();
  await page.getByRole('button', { name: 'Salvar e continuar' }).click();
  await page.getByLabel(/Conferi a lista/).check();
  await page.getByRole('button', { name: 'Salvar e continuar' }).click();
  await page.getByRole('button', { name: 'Pular' }).click();
  await page.getByRole('button', { name: 'Salvar e continuar' }).click();
  await page.getByRole('button', { name: 'Salvar e continuar' }).click();
  await page.getByRole('button', { name: 'Gerar meu plano' }).click();
  await page.getByRole('link', { name: 'Perfil e configurações' }).click();
  await expect(page.getByLabel('Tocar bipe quando o descanso acabar')).toBeChecked();
  await page.getByRole('button', { name: 'Testar som' }).click();
  // 1º toque: arquivo ainda carregando → bipe sintetizado (3 × 2400 Hz). 2º toque: toca o arquivo rest_beep.wav.
  await expect.poll(() => page.evaluate(() => (window as unknown as { __beeps: unknown[] }).__beeps.length)).toBeGreaterThan(0);
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Testar som' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __beeps: unknown[] }).__beeps)).toContain('arquivo:0.62');
});

test('alternar entre os treinos de 3, 4 e 5 dias, cada um guardando sua semana', async ({ page }) => {
  page.on('dialog', (d) => void d.accept());
  await page.goto('/');
  await page.getByRole('button', { name: 'Usar em modo local' }).click();
  await page.getByLabel('Confirmo que estes dados estão atuais.').check();
  await page.getByRole('button', { name: 'Salvar e continuar' }).click();
  await page.getByLabel(/Conferi a lista/).check();
  await page.getByRole('button', { name: 'Salvar e continuar' }).click();
  await page.getByRole('button', { name: 'Pular' }).click();
  await page.getByRole('button', { name: 'Salvar e continuar' }).click();
  await page.getByRole('button', { name: 'Salvar e continuar' }).click();
  await page.getByRole('button', { name: 'Gerar meu plano' }).click();
  await page.getByRole('link', { name: 'Treino' }).first().click();
  await expect(page.getByText(/^Protocolo JKK — 4 dias · início/)).toBeVisible();

  await page.getByRole('radio', { name: /5 dias/ }).click();
  await expect(page.getByText(/^Protocolo JKK · início/)).toBeVisible();
  await expect(page.getByText('Próxima sessão: Dia 1 · Peito superior + Ombros + Tríceps')).toBeVisible();
  await expect(page.getByRole('radio', { name: /5 dias/ })).toHaveAttribute('aria-checked', 'true');

  // 3 dias: corpo inteiro, 28 séries por treino, com a explicação e a comparação
  await page.getByRole('radio', { name: /3 dias/ }).click();
  await expect(page.getByText(/^Protocolo JKK — 3 dias · início/)).toBeVisible();
  await expect(page.getByText('Próxima sessão: Dia 1 · Corpo inteiro A — Peito superior + Costas (largura) + Quadríceps + Braços')).toBeVisible();
  await expect(page.getByText(/SEG · ~95 min · 28 séries/).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Revisões automáticas' })).toBeVisible();
  await page.getByText('Sobre o protocolo (avaliação, regras, flancos e fontes)').click();
  await expect(page.getByText('Por que o treino de 3 dias foi montado assim')).toBeVisible();
  await page.screenshot({ path: `test-results/tresdias-${test.info().project.name}.png`, fullPage: true });
  // em casa também existe para o plano de 3 dias
  await page.getByRole('radio', { name: /Em casa/ }).click();
  await expect(page.getByText('Próxima sessão: Em casa · Corpo inteiro A — Peito superior + Costas + Quadríceps + Braços')).toBeVisible();

  await page.getByRole('radio', { name: /4 dias/ }).click();
  await expect(page.getByText(/^Protocolo JKK — 4 dias · início/)).toBeVisible();
  await expect(page.getByText('Próxima sessão: Dia 1 · Superior A — Peito superior + Costas (largura) + Ombro + Tríceps')).toBeVisible();
});

test('tela Hoje: registrar o peso rápido', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Usar em modo local' }).click();
  await page.getByLabel('Confirmo que estes dados estão atuais.').check();
  await page.getByRole('button', { name: 'Salvar e continuar' }).click();
  await page.getByLabel(/Conferi a lista/).check();
  await page.getByRole('button', { name: 'Salvar e continuar' }).click();
  await page.getByRole('button', { name: 'Pular' }).click();
  await page.getByRole('button', { name: 'Salvar e continuar' }).click();
  await page.getByRole('button', { name: 'Salvar e continuar' }).click();
  await page.getByRole('button', { name: 'Gerar meu plano' }).click();
  await expect(page.getByRole('region', { name: 'Treino de hoje' })).toBeVisible();
  await page.getByLabel('Peso de hoje (kg)').fill('75,2');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText('Registrado: 75,2 kg — corrigir')).toBeVisible();
  await expect(page.locator('.tile').filter({ hasText: 'Peso' }).getByText('75,2 kg')).toBeVisible();
});

test('treino em casa (peso do corpo), suplementos e fase de recomposição', async ({ page }, info) => {
  page.on('dialog', (d) => void d.accept());
  await page.goto('/');
  await page.getByRole('button', { name: 'Usar em modo local' }).click();
  await page.getByLabel('Confirmo que estes dados estão atuais.').check();
  await page.getByRole('button', { name: 'Salvar e continuar' }).click();
  await page.getByLabel(/Conferi a lista/).check();
  await page.getByRole('button', { name: 'Salvar e continuar' }).click();
  await page.getByRole('button', { name: 'Pular' }).click();
  await page.getByRole('button', { name: 'Salvar e continuar' }).click();
  await page.getByRole('button', { name: 'Salvar e continuar' }).click();
  await page.getByRole('button', { name: 'Gerar meu plano' }).click();

  // Treino em casa: mesma sessão do ciclo, só com o peso do corpo
  await page.getByRole('link', { name: 'Treino' }).first().click();
  await page.getByRole('radio', { name: /Em casa/ }).click();
  await expect(page.getByText('Próxima sessão: Em casa · Superior A — Peito superior + Costas + Ombro + Tríceps')).toBeVisible();
  await expect(page.getByText('Flexão declinada (pés na cadeira)').first()).toBeVisible();
  await page.screenshot({ path: `test-results/casa-${info.project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Iniciar treino' }).click();
  await expect(page.getByText(/Treino em casa, só com o peso do corpo/)).toBeVisible();
  await expect(page.getByLabel('Carga série 1').first()).toHaveValue('0');
  await page.getByLabel('Repetições série 1').first().fill('10');
  await page.getByLabel('RIR série 1').first().fill('1');
  await page.getByRole('button', { name: 'Concluir série 1' }).first().click();
  await expect(page.getByText(/Série 1: 10 reps com RIR 1: dentro do alvo/)).toBeVisible();
  await page.getByRole('button', { name: 'Pular' }).click();
  await page.getByRole('button', { name: 'Concluir treino' }).click();
  await expect(page.getByText('Treino concluído e salvo!')).toBeVisible();
  // a sessão em casa contou no ciclo: a próxima é o Dia 2
  await expect(page.getByText(/Próxima sessão: Dia 2/)).toBeVisible();

  // Suplementos: guia honesto + protocolo pessoal
  await page.getByRole('link', { name: 'Nutrição' }).first().click();
  await page.getByRole('tab', { name: 'Suplementos' }).click();
  await expect(page.getByText(/Nenhum suplemento dá 1000%/)).toBeVisible();
  await page.getByRole('checkbox', { name: /Creatina monohidratada/ }).check();
  await expect(page.getByRole('checkbox', { name: /Creatina monohidratada/ })).toBeChecked();
  await page.screenshot({ path: `test-results/suplementos-${info.project.name}.png`, fullPage: true });

  // Fase de recomposição muda a meta
  await page.getByRole('tab', { name: 'Metas' }).click();
  await expect(page.locator('.stat-v').first()).toHaveText('3000');
  await page.getByRole('radio', { name: /Perder gordura e ganhar massa/ }).click();
  await expect(page.locator('.stat-v').first()).toHaveText('2500');
  await expect(page.getByRole('radio', { name: /Perder gordura e ganhar massa/ })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText('Como é a dieta para perder gordura e ganhar massa')).toBeVisible();

  // No Treino: mesmo objetivo, com finalizador funcional e corda no fim de semana
  await page.getByRole('link', { name: 'Treino' }).first().click();
  await expect(page.getByRole('radio', { name: /Perder gordura e ganhar massa/ })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('heading', { name: 'Cardio do fim de semana: pular corda' })).toBeVisible();
  await expect(page.getByText(/Sábado · Corda intervalada \(forte\)/)).toBeVisible();
  await expect(page.getByText(/8 séries de 30 s pulando, 60 s de descanso/)).toBeVisible();
  await page.screenshot({ path: `test-results/recomp-${info.project.name}.png`, fullPage: true });
  // Cronômetro da corda
  await page.getByRole('link', { name: 'Abrir cronômetro' }).click();
  await expect(page.getByRole('heading', { name: 'Pular corda' })).toBeVisible();
  await page.getByRole('button', { name: /Iniciar cronômetro \(8 × 30 s\)/ }).click();
  await expect(page.getByRole('timer')).toContainText('PULE');
  await expect(page.getByRole('timer')).toContainText('Série 1/8');
  await page.getByRole('button', { name: 'Parar' }).click();
  await page.getByRole('button', { name: /marcar como feito/ }).click();
  await expect(page.getByText(/feito ✓/)).toBeVisible();
  await page.screenshot({ path: `test-results/corda-${info.project.name}.png`, fullPage: true });

  // Creatina entrou na Missão
  await page.getByRole('link', { name: 'Missão' }).click();
  await page.getByRole('button', { name: 'Começar hoje' }).click();
  await expect(page.getByLabel('Creatina do dia (3–5 g)')).toBeVisible();
});

test('backup: exportar e restaurar os dados', async ({ page }) => {
  page.on('dialog', (d) => void d.accept());
  await page.goto('/');
  await page.getByRole('button', { name: 'Usar em modo local' }).click();
  await page.getByLabel('Confirmo que estes dados estão atuais.').check();
  await page.getByRole('button', { name: 'Salvar e continuar' }).click();
  await page.getByLabel(/Conferi a lista/).check();
  await page.getByRole('button', { name: 'Salvar e continuar' }).click();
  await page.getByRole('button', { name: 'Pular' }).click();
  await page.getByRole('button', { name: 'Salvar e continuar' }).click();
  await page.getByRole('button', { name: 'Salvar e continuar' }).click();
  await page.getByRole('button', { name: 'Gerar meu plano' }).click();
  await page.getByLabel('Peso de hoje (kg)').fill('75,2');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText('Registrado: 75,2 kg — corrigir')).toBeVisible();

  await page.getByRole('link', { name: 'Perfil e configurações' }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Fazer backup' }).click()]);
  const path = await download.path();
  const fs = await import('node:fs');
  const backup = JSON.parse(fs.readFileSync(path, 'utf8'));
  expect(backup.body_metrics[0].weight_kg).toBe(75.2);
  expect(backup.programs[0].name).toBe('Protocolo JKK — 4 dias');

  await page.getByLabel('Arquivo de backup').setInputFiles({ name: 'titan-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await expect(page.getByText(/Backup restaurado: \d+ registros/)).toBeVisible();
});
