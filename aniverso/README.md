# AniVerso

Aplicativo (site instalável no celular e no PC) com o catálogo de animes do mundo todo, mostrando
**quais têm dublagem em português do Brasil**, quais são só legendados e **onde assistir legalmente**.

## O que ele faz

- **Início**: animes em alta, temporada atual, dublados em PT-BR, mais bem avaliados, mais populares e filmes.
- **Explorar**: busca por nome e filtros de **Áudio** (Dublado PT-BR, Dublado em inglês, Só legendado),
  gênero, formato, situação, ano e ordem. Role a tela para carregar mais.
- **Página do anime**: sinopse (com botão para traduzir), se é dublado ou legendado, trailer,
  ficha técnica, contagem para o próximo episódio, temporadas/filmes relacionados, recomendações
  e botões para as plataformas oficiais (Crunchyroll, Netflix, Prime Video etc.) + JustWatch Brasil.
- **Grátis**: episódios completos publicados de graça pelos donos dos animes em canais oficiais do YouTube
  (Crunchyroll Brasil, Yu-Gi-Oh! Brasil, Pokémon), com selo **GRÁTIS** nas capas, filtro "Grátis" no Explorar
  e um guia de outros caminhos gratuitos e legais (Pluto TV, Bilibili, testes grátis).
- **Episódios**: lista de episódios com miniatura (quando a Crunchyroll tem o anime). Toque para assistir;
  o app marca como visto e mostra **Continuar assistindo** no início.
- **Assistir sem sair do app** (no APK): Crunchyroll, YouTube, Bilibili TV e outras abrem o player da
  plataforma dentro do AniVerso. Netflix, Prime Video e parecidos abrem no app oficial deles.
- **Player**: toca vídeos que estão no seu aparelho ou um link direto de vídeo (MP4, WebM, MKV, M3U8),
  com legenda .srt/.vtt, "Pular abertura", velocidade, fila e retomada de onde parou.
- **Minha lista**: marque como Assistindo, Quero ver, Concluído, Pausado ou Abandonado (fica salvo no aparelho).
- Selo **DUB PT** / **DUB EN** em cada capa.

O AniVerso **não hospeda nem transmite vídeos de anime**. Os episódios tocam no player das plataformas
oficiais (algumas pedem assinatura), e o Player só toca arquivos e links que você mesmo abrir.

## De onde vêm os dados

| Dado | Fonte |
| --- | --- |
| Catálogo, capas, sinopses, trailers, links de streaming | [AniList](https://anilist.co) (API pública GraphQL) |
| Quais animes têm dublagem PT-BR / inglês | [MyDubList](https://github.com/Joelis57/MyDubList) (licença CC BY 4.0) |
| Episódios grátis (`gratis.json`) | Canais oficiais do YouTube, lidos pelo robô `ferramentas/catalogo-gratis.mjs` |

## Atualizar a lista de episódios grátis

```bash
node ferramentas/catalogo-gratis.mjs   # leva uns 5 minutos
```

O GitHub também roda isso sozinho toda segunda-feira (`.github/workflows/atualizar-gratis.yml`), depois que
estes arquivos estiverem no branch principal. O app sempre tenta baixar a lista mais nova de lá e, se não
conseguir, usa a cópia que vem junto.

## Como usar

É um site estático: só HTML, CSS e JavaScript, sem instalação de nada.

**No computador, para testar:**

```bash
cd aniverso
python3 -m http.server 8080
# abra http://localhost:8080 no navegador
```

**Para usar no celular como aplicativo:** publique a pasta `aniverso/` em qualquer hospedagem
estática gratuita (Netlify, GitHub Pages, Cloudflare Pages, Vercel). Depois abra o endereço no
celular e escolha **"Adicionar à tela inicial"** (Chrome: menu ⋮ → Instalar app; iPhone: Compartilhar → Adicionar à Tela de Início).

## Arquivos

- `index.html`: estrutura da página
- `styles.css`: visual (tema escuro e claro automáticos)
- `app.js`: toda a lógica (buscas, filtros, telas, lista)
- `sw.js` + `manifest.webmanifest` + `icons/`: permitem instalar como aplicativo
- APK para Android: veja a pasta `../aniverso-apk`
