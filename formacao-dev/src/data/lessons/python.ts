import type { Lesson } from '../types';

// Python: segunda linguagem do curso (dados, IA, automação, backend).
// O app roda Python de verdade, offline, com o interpretador Skulpt.

export const python: Lesson[] = [
  {
    id: 'l-python-1', area: 'fund', phase: 1,
    title: 'Python 1: primeiros passos (comparando com JavaScript)',
    goal: 'Escrever programas em Python com variáveis, print, input simulado, if e f-strings.',
    minutes: 18, competencies: ['python'], prereqs: ['l-cond', 'l-langs'],
    steps: [
      { kind: 'text', title: 'Por que Python?', body: 'Python é famoso por ser fácil de ler. É a linguagem nº 1 em dados e inteligência artificial e muito usada em automação e backend (Django, FastAPI). Você já sabe lógica com JavaScript — agora é só aprender a nova "gramática".' },
      { kind: 'table', title: 'JavaScript × Python', body: 'Mesma ideia, escrita diferente:', table: { headers: ['Conceito', 'JavaScript', 'Python'], rows: [
        ['Mostrar na tela', 'console.log("oi")', 'print("oi")'],
        ['Variável', 'let idade = 20', 'idade = 20'],
        ['Texto com variável', '`Oi ${nome}`', 'f"Oi {nome}"'],
        ['Verdadeiro/falso', 'true / false', 'True / False'],
        ['E / OU / NÃO', '&& / || / !', 'and / or / not'],
        ['Bloco do if', '{ ... }', 'dois-pontos + indentação'],
        ['Comentário', '// comentário', '# comentário'],
        ['Lista', '[1, 2, 3]', '[1, 2, 3]'],
      ] } },
      { kind: 'python', title: 'Rode seu primeiro Python', body: 'Toque em Executar. Depois mude o nome e a idade.', code: '# Variáveis não precisam de let/const\nnome = "Ana"\nidade = 25\n\nprint("Olá,", nome)\nprint(f"Ano que vem você terá {idade + 1} anos")\n\nif idade >= 18:\n    print("Maior de idade")   # 4 espaços = dentro do if\nelse:\n    print("Menor de idade")\n\nprint("Fim")                   # sem espaços = fora do if', explain8: { what: 'Cria variáveis, mostra mensagens e decide com if/else.', parts: 'f"...{expressão}..." insere valores no texto. Os dois-pontos (:) abrem o bloco; a indentação define o que está dentro.', expected: 'Olá, Ana\nAno que vem você terá 26 anos\nMaior de idade\nFim', errors: 'Esquecer os dois-pontos dá SyntaxError; indentação errada dá IndentationError.' } },
      { kind: 'python', title: 'Tipos e conversões', body: 'Em Python, juntar texto com número dá erro — é preciso converter.', code: 'preco = 19.9          # float (número com ponto)\nquantidade = 3        # int (inteiro)\ntotal = preco * quantidade\nprint(type(preco), type(quantidade))\nprint("Total: R$", round(total, 2))\n\ntexto = "10"\nprint(int(texto) + 5)     # converte texto em número: 15\nprint(texto + str(5))     # converte número em texto: "105"' },
      { kind: 'warning', title: 'A indentação é obrigatória', body: 'Em JavaScript, os espaços são só estética. Em Python eles FAZEM PARTE do código. Use sempre 4 espaços dentro de if, for, def etc. O VS Code faz isso sozinho ao apertar Tab.' },
    ],
    simpler: 'Python é como JavaScript sem ponto e vírgula e sem chaves: print() mostra, variável = valor, e os blocos são definidos pelos espaços no início da linha.',
    otherWay: 'Se JavaScript é um texto com parênteses e chaves organizando tudo, Python é um texto organizado em tópicos e subtópicos (com recuo).',
    realExample: 'Um analista de dados escreve: if faturamento > meta: print(f"Meta batida em {mes}!") — leitura quase em inglês.',
    exercises: [
      { id: 'e-py1-1', type: 'mcq', competency: 'python', prompt: 'Qual comando mostra "Olá" na tela em Python?', options: ['console.log("Olá")', 'print("Olá")', 'echo "Olá"', 'System.out.println("Olá")'], answer: 1, hints: ['Imprimir, em inglês.'], solution: 'print("Olá")', explanation: 'print() é a função de saída do Python.', errorKind: 'sintaxe' },
      { id: 'e-py1-2', type: 'predict', competency: 'python', lang: 'py', prompt: 'Qual é a saída deste código Python?', code: 'x = 7\nif x > 5:\n    print("grande")\nprint("ok")', expected: 'grande\nok', run: true, hints: ['O último print está fora do if.'], solution: 'grande\nok', explanation: '7 > 5 é True, então imprime "grande". O print("ok") não está indentado, então roda sempre.', errorKind: 'logica' },
      { id: 'e-py1-3', type: 'py', competency: 'python', prompt: 'Crie as variáveis nome = "Bia" e idade = 30 e imprima exatamente: Bia tem 30 anos  (use f-string).', starter: '# crie as variáveis e use print(f"...")\n', stdout: 'Bia tem 30 anos', hints: ['nome = "Bia"', 'print(f"{nome} tem {idade} anos")'], solution: 'nome = "Bia"\nidade = 30\nprint(f"{nome} tem {idade} anos")', explanation: 'f-strings inserem variáveis no texto entre chaves.', errorKind: 'sintaxe' },
      { id: 'e-py1-4', type: 'py', competency: 'python', prompt: 'Crie a variável nota = 6.5. Imprima "Aprovado" se a nota for maior ou igual a 7, senão "Recuperação".', starter: 'nota = 6.5\n', stdout: 'Recuperação', hints: ['if nota >= 7:', 'else:'], solution: 'nota = 6.5\nif nota >= 7:\n    print("Aprovado")\nelse:\n    print("Recuperação")', explanation: 'if/else com dois-pontos e blocos indentados.', errorKind: 'sintaxe' },
      { id: 'e-py1-5', type: 'mcq', competency: 'python', prompt: 'Qual é o resultado de "5" + str(5) em Python?', options: ['10', '"55"', 'Erro', '55.0'], answer: 1, hints: ['str() transforma em texto.'], solution: '"55"', explanation: 'Os dois são textos, então o + junta (concatena): "55".', errorKind: 'logica' },
      { id: 'e-py1-6', type: 'mcq', competency: 'python', prompt: 'Você rodou "5" + 5 em Python e apareceu TypeError. Por quê?', options: ['Python não sabe somar', 'Não dá para juntar texto (str) com número (int) sem converter', 'Faltou ponto e vírgula', 'O número 5 é proibido'], answer: 1, hints: ['JavaScript converteria sozinho; Python não.'], solution: 'Não dá para juntar texto (str) com número (int) sem converter', explanation: 'Python é mais rigoroso que JavaScript com tipos: use int("5") + 5 ou "5" + str(5).', errorKind: 'interpretacao' },
    ],
    docs: [{ label: 'Tutorial oficial de Python (pt-BR)', url: 'https://docs.python.org/pt-br/3/tutorial/' }],
  },

  {
    id: 'l-python-2', area: 'fund', phase: 1,
    title: 'Python 2: listas, dicionários, laços e funções',
    goal: 'Usar listas, dicionários, for, while e funções em Python para resolver problemas reais.',
    minutes: 20, competencies: ['python'], prereqs: ['l-python-1', 'l-data'],
    steps: [
      { kind: 'python', title: 'Listas e for', body: 'O for do Python percorre direto os itens:', code: 'notas = [8.5, 6.0, 9.0, 7.5]\n\nfor nota in notas:\n    print("Nota:", nota)\n\nprint("Quantidade:", len(notas))\nprint("Média:", sum(notas) / len(notas))\nprint("Maior:", max(notas))\n\nnotas.append(10)          # adiciona no fim\nprint(notas)\n\nfor i in range(3):        # 0, 1, 2\n    print("Volta", i)' },
      { kind: 'python', title: 'Dicionários (equivalem aos objetos do JavaScript)', body: 'Chave → valor. Muito usado para representar registros, como um usuário:', code: 'usuario = {"nome": "Ana", "idade": 25, "cidade": "Recife"}\n\nprint(usuario["nome"])\nusuario["idade"] = 26           # altera\nusuario["email"] = "ana@x.com"  # adiciona\n\nfor chave, valor in usuario.items():\n    print(chave, "→", valor)\n\n# Lista de dicionários: igual a um JSON vindo de uma API\nprodutos = [{"nome": "Mouse", "preco": 50}, {"nome": "Teclado", "preco": 120}]\ntotal = 0\nfor p in produtos:\n    total += p["preco"]\nprint("Total:", total)' },
      { kind: 'python', title: 'Funções com def', body: 'def cria uma função; return devolve o resultado.', code: 'def calcular_desconto(preco, porcentagem=10):\n    """Devolve o preço com desconto (padrão: 10%)."""\n    return preco - preco * porcentagem / 100\n\nprint(calcular_desconto(100))        # 90.0\nprint(calcular_desconto(100, 25))    # 75.0\n\n# list comprehension: criar listas em uma linha\nquadrados = [n * n for n in range(1, 6)]\npares = [n for n in range(10) if n % 2 == 0]\nprint(quadrados, pares)' },
      { kind: 'tip', title: 'Convenções de nomes', body: 'Em Python usamos snake_case (palavras_separadas_por_underline): calcular_desconto, total_de_vendas. Em JavaScript usamos camelCase: calcularDesconto.' },
      { kind: 'tip', title: 'Onde praticar mais', body: 'O Python Tutor (pythontutor.com) mostra, passo a passo, o que acontece na memória — ótimo para entender laços. O Curso em Vídeo tem 3 "mundos" gratuitos de Python com exercícios.' },
    ],
    simpler: 'Lista = [itens]. Dicionário = {"chave": valor}. for item in lista percorre. def nome(): cria função e return devolve o resultado.',
    otherWay: 'Lista é uma fila de pessoas (ordem importa). Dicionário é uma agenda telefônica (você procura pelo nome, a chave).',
    realExample: 'Um script de automação lê uma planilha de clientes como uma lista de dicionários e, para cada cliente com boleto vencido, envia um e-mail.',
    exercises: [
      { id: 'e-py2-1', type: 'py', competency: 'python', prompt: 'Crie a função soma_lista(numeros) que devolve a soma dos números SEM usar sum() (use um for).', starter: 'def soma_lista(numeros):\n    total = 0\n    # percorra e some\n    return total\n', tests: [{ call: 'soma_lista([1, 2, 3])', expect: '6', desc: '[1,2,3] → 6' }, { call: 'soma_lista([])', expect: '0', desc: 'lista vazia → 0' }, { call: 'soma_lista([10, -5])', expect: '5', desc: '[10,-5] → 5' }], hints: ['for n in numeros:', '    total += n'], solution: 'def soma_lista(numeros):\n    total = 0\n    for n in numeros:\n        total += n\n    return total', explanation: 'Acumulador: começa em 0 e soma cada item. Atenção à indentação do for e do total += n.', errorKind: 'logica' },
      { id: 'e-py2-2', type: 'py', competency: 'python', prompt: 'Crie a função pares(numeros) que devolve uma NOVA lista só com os números pares.', starter: 'def pares(numeros):\n    pass  # troque pelo seu código\n', tests: [{ call: 'pares([1, 2, 3, 4])', expect: '[2, 4]', desc: '[1,2,3,4] → [2, 4]' }, { call: 'pares([1, 3])', expect: '[]', desc: 'sem pares → []' }], hints: ['Par: n % 2 == 0', 'return [n for n in numeros if n % 2 == 0]'], solution: 'def pares(numeros):\n    return [n for n in numeros if n % 2 == 0]', explanation: 'List comprehension filtra numa linha. Também daria com for + append.', errorKind: 'logica' },
      { id: 'e-py2-3', type: 'py', competency: 'python', prompt: 'Crie a função total_carrinho(itens): itens é uma lista de dicionários com "preco" e "qtd". Devolva a soma de preco × qtd.', starter: 'def total_carrinho(itens):\n    pass\n', tests: [{ call: 'total_carrinho([{"preco": 10, "qtd": 2}, {"preco": 5, "qtd": 3}])', expect: '35', desc: '10×2 + 5×3 = 35' }, { call: 'total_carrinho([])', expect: '0', desc: 'vazio → 0' }], hints: ['total = 0', 'for item in itens: total += item["preco"] * item["qtd"]'], solution: 'def total_carrinho(itens):\n    total = 0\n    for item in itens:\n        total += item["preco"] * item["qtd"]\n    return total', explanation: 'Mesma lógica do JavaScript, acessando o dicionário com colchetes e a chave entre aspas.', errorKind: 'logica' },
      { id: 'e-py2-4', type: 'predict', competency: 'python', lang: 'py', prompt: 'Qual é a saída?', code: 'aluno = {"nome": "Leo", "nota": 8}\naluno["nota"] = aluno["nota"] + 1\nprint(aluno["nome"], aluno["nota"])', expected: 'Leo 9', run: true, hints: ['A nota recebe ela mesma + 1.'], solution: 'Leo 9', explanation: 'O dicionário é alterado; print com vírgula separa os valores por espaço.', errorKind: 'logica' },
      { id: 'e-py2-5', type: 'py', competency: 'python', prompt: 'Crie a função contar_palavras(frase) que devolve um dicionário com quantas vezes cada palavra aparece. Ex.: "a b a" → {"a": 2, "b": 1}. Teste: contar_palavras("sol lua sol")["sol"] deve ser 2.', starter: 'def contar_palavras(frase):\n    contagem = {}\n    for palavra in frase.split():\n        pass  # se já existe, some 1; senão, comece com 1\n    return contagem\n', tests: [{ call: 'contar_palavras("sol lua sol")["sol"]', expect: '2', desc: '"sol" aparece 2 vezes' }, { call: 'contar_palavras("sol lua sol")["lua"]', expect: '1', desc: '"lua" aparece 1 vez' }, { call: 'len(contar_palavras(""))', expect: '0', desc: 'frase vazia → dicionário vazio' }], hints: ['contagem[palavra] = contagem.get(palavra, 0) + 1'], solution: 'def contar_palavras(frase):\n    contagem = {}\n    for palavra in frase.split():\n        contagem[palavra] = contagem.get(palavra, 0) + 1\n    return contagem', explanation: 'dict.get(chave, 0) devolve 0 quando a chave ainda não existe — padrão clássico de contagem.', errorKind: 'logica' },
      { id: 'e-py2-6', type: 'mcq', competency: 'python', prompt: 'Qual estrutura do Python equivale a um objeto { nome: "Ana" } do JavaScript?', options: ['Lista', 'Dicionário', 'Tupla', 'String'], answer: 1, hints: ['Chave → valor.'], solution: 'Dicionário', explanation: 'Dicionários guardam pares chave: valor, como objetos JS e como JSON.', errorKind: 'conhecimento' },
    ],
    docs: [{ label: 'Python Tutor: visualize seu código', url: 'https://pythontutor.com/' }],
  },

  {
    id: 'l-python-auto', area: 'ia', phase: 2,
    title: 'Python para automação: deixe o computador trabalhar por você',
    goal: 'Entender o que dá para automatizar e escrever scripts que processam textos, listas e arquivos.',
    minutes: 16, competencies: ['automation-py'], prereqs: ['l-python-2'],
    steps: [
      { kind: 'text', title: 'O que é automação', body: 'Automação é escrever um programa para fazer uma tarefa repetitiva no seu lugar: renomear 500 arquivos, juntar planilhas, mandar e-mails de cobrança, baixar relatórios de um site, gerar PDFs… Tarefas de horas viram segundos.' },
      { kind: 'table', title: 'Bibliotecas populares (para usar no computador)', body: 'Instale com: pip install nome-da-biblioteca', table: { headers: ['Tarefa', 'Biblioteca'], rows: [
        ['Arquivos e pastas', 'os, pathlib, shutil (já vêm com o Python)'],
        ['Planilhas Excel', 'openpyxl, pandas'],
        ['Chamar APIs', 'requests, httpx'],
        ['Automatizar o navegador', 'Selenium, Playwright'],
        ['Enviar e-mails', 'smtplib (já vem)'],
        ['Agendar tarefas', 'schedule, cron (Linux), Agendador de Tarefas (Windows)'],
        ['Automação sem código', 'n8n, Make, Zapier (ferramentas visuais)'],
      ] } },
      { kind: 'python', title: 'Exemplo: processando um "arquivo" de vendas', body: 'Simulamos um CSV (texto separado por vírgulas) e geramos um relatório:', code: 'csv = """vendedor,valor\nAna,1200\nBruno,800\nAna,450\nCarla,2000\nBruno,300"""\n\nlinhas = csv.strip().split("\\n")[1:]   # pula o cabeçalho\ntotais = {}\nfor linha in linhas:\n    vendedor, valor = linha.split(",")\n    totais[vendedor] = totais.get(vendedor, 0) + float(valor)\n\nprint("=== Relatório de vendas ===")\nfor vendedor, total in sorted(totais.items(), key=lambda x: -x[1]):\n    print(f"{vendedor:<8} R$ {total:>8.2f}")\nprint("Campeão:", max(totais, key=totais.get))' },
      { kind: 'code', title: 'No seu computador: renomear arquivos', lang: 'py', body: 'Script real (não roda no app porque mexe em arquivos do computador):', code: 'from pathlib import Path\n\npasta = Path("C:/Users/voce/Downloads/fotos")\nfor i, arquivo in enumerate(sorted(pasta.glob("*.jpg")), start=1):\n    novo = pasta / f"viagem_{i:03}.jpg"   # viagem_001.jpg, viagem_002.jpg...\n    arquivo.rename(novo)\n    print("Renomeado:", novo.name)' },
      { kind: 'warning', title: 'Automação com responsabilidade', body: 'Teste sempre numa CÓPIA dos arquivos. Ao automatizar sites, respeite os termos de uso e não sobrecarregue servidores. Nunca coloque senhas direto no código: use variáveis de ambiente.' },
    ],
    simpler: 'Automação = um script que repete uma tarefa chata por você. Python tem bibliotecas prontas para arquivos, planilhas, e-mails e sites.',
    otherWay: 'É como programar a máquina de lavar: você configura uma vez e ela faz o trabalho sozinha todas as vezes.',
    realExample: 'Um backend de loja roda, toda madrugada, um script que gera o relatório de vendas do dia e envia por e-mail para os gerentes.',
    exercises: [
      { id: 'e-pyauto-1', type: 'py', competency: 'automation-py', prompt: 'Crie a função extrair_emails(texto) que devolve a lista de palavras que contêm "@". Ex.: "fale com ana@x.com ou bia@y.com" → ["ana@x.com", "bia@y.com"].', starter: 'def extrair_emails(texto):\n    pass\n', tests: [{ call: 'extrair_emails("fale com ana@x.com ou bia@y.com")', expect: "['ana@x.com', 'bia@y.com']", desc: 'acha os dois e-mails' }, { call: 'extrair_emails("sem email aqui")', expect: '[]', desc: 'sem e-mails → []' }], hints: ['texto.split() separa as palavras.', 'return [p for p in texto.split() if "@" in p]'], solution: 'def extrair_emails(texto):\n    return [p for p in texto.split() if "@" in p]', explanation: 'Separar em palavras e filtrar as que têm "@". (Na vida real usaríamos expressões regulares, mais precisas.)', errorKind: 'logica' },
      { id: 'e-pyauto-2', type: 'py', competency: 'automation-py', prompt: 'Crie novo_nome(i) que devolve nomes padronizados de arquivo com 3 dígitos: novo_nome(7) → "foto_007.jpg".', starter: 'def novo_nome(i):\n    pass\n', tests: [{ call: 'novo_nome(7)', expect: 'foto_007.jpg', desc: '7 → foto_007.jpg' }, { call: 'novo_nome(123)', expect: 'foto_123.jpg', desc: '123 → foto_123.jpg' }], hints: ['f"foto_{i:03}.jpg" completa com zeros à esquerda.'], solution: 'def novo_nome(i):\n    return f"foto_{i:03}.jpg"', explanation: 'O formato :03 completa o número com zeros até ter 3 dígitos.', errorKind: 'sintaxe' },
      { id: 'e-pyauto-3', type: 'mcq', competency: 'automation-py', prompt: 'Qual biblioteca Python é usada para fazer requisições a APIs?', options: ['requests', 'pandas', 'pygame', 'math'], answer: 0, hints: ['Requisições, em inglês.'], solution: 'requests', explanation: 'requests.get(url).json() é a forma mais simples de consumir uma API em Python.', errorKind: 'conhecimento' },
      { id: 'e-pyauto-4', type: 'mcq', competency: 'automation-py', prompt: 'Antes de rodar um script que renomeia ou apaga arquivos, o mais prudente é…', options: ['Rodar direto na pasta original', 'Testar numa cópia dos arquivos', 'Desligar o antivírus', 'Rodar como administrador'], answer: 1, hints: ['Pense no pior caso.'], solution: 'Testar numa cópia dos arquivos', explanation: 'Um bug num script de arquivos pode destruir dados. Teste em cópia e só depois rode no original.', errorKind: 'conhecimento' },
    ],
    docs: [{ label: 'Hashtag Programação: playlist de automações com Python', url: 'https://www.youtube.com/playlist?list=PLpdAy0tYrnKyjrY1Fr72DhmrRmeWI_5C8' }],
  },
];
