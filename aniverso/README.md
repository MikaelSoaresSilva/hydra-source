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
- **Minha lista**: marque como Assistindo, Quero ver, Concluído, Pausado ou Abandonado (fica salvo no aparelho).
- Selo **DUB PT** / **DUB EN** em cada capa.

O AniVerso **não hospeda nem transmite vídeos**. Ele mostra as informações e leva você ao serviço
oficial onde o anime está disponível.

## De onde vêm os dados

| Dado | Fonte |
| --- | --- |
| Catálogo, capas, sinopses, trailers, links de streaming | [AniList](https://anilist.co) (API pública GraphQL) |
| Quais animes têm dublagem PT-BR / inglês | [MyDubList](https://github.com/Joelis57/MyDubList) (licença CC BY 4.0) |

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
