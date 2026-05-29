# Guia de publicacao no Firebase Hosting

Este projeto ja esta preparado para publicar o site estatico da pasta `stock-markets-site` no Firebase Hosting.

## O que ja foi configurado

- `firebase.json` aponta o Hosting para `stock-markets-site`.
- `package.json` inclui scripts para login, selecao de projeto, emulador local, preview e deploy.
- `.firebaserc.example` mostra o formato do arquivo que vincula este repositorio ao seu projeto Firebase.
- `stock-markets-site/404.html` foi adicionada para rotas inexistentes.
- `stock-markets-site/game/` publica o jogo atual em `/game/`.
- `stock-markets-site/game/jogo.html`, `/jogo` e o caminho antigo `/Crash_Market_Survivor/index.html` redirecionam para `/game/`.
- Tambem existem paginas estaticas de compatibilidade em `stock-markets-site/jogo/` e `stock-markets-site/Crash_Market_Survivor/` para evitar 404 caso algum redirect do Hosting nao seja aplicado em preview/local.

## O que a IA nao consegue concluir sem sua conta

Voce precisa fazer login na sua conta Google/Firebase e escolher ou criar um projeto Firebase. Essa etapa exige autenticacao interativa no navegador, entao precisa ser feita por voce.

## Passo a passo

1. Crie um projeto no Firebase Console:
   https://console.firebase.google.com/

2. No terminal, dentro da raiz do repositorio, faca login:

   ```powershell
   npm run firebase:login
   ```

3. Vincule este repositorio ao projeto Firebase:

   ```powershell
   npm run firebase:use
   ```

   Escolha o projeto criado no Firebase Console e use o alias `default`.

   Alternativa manual: copie `.firebaserc.example` para `.firebaserc` e troque `seu-id-do-projeto-firebase` pelo ID real do projeto.

4. Teste localmente com o emulador do Firebase Hosting:

   ```powershell
   npm run firebase:serve
   ```

   Abra a URL mostrada no terminal, normalmente `http://127.0.0.1:5000`.

5. Publique um preview temporario:

   ```powershell
   npm run firebase:preview
   ```

6. Quando estiver tudo certo, publique em producao:

   ```powershell
   npm run firebase:deploy
   ```

   Ao final, o Firebase vai mostrar URLs como:

   - `https://SEU_PROJETO.web.app`
   - `https://SEU_PROJETO.firebaseapp.com`

## Sobre o jogo

O jogo atual esta em `stock-markets-site/game/` e usa PixiJS carregado por CDN:

```html
https://cdn.jsdelivr.net/npm/pixi.js@7.4.2/dist/pixi.min.js
```

Isso funciona no Firebase Hosting, mas a pagina do jogo depende de conexao com o CDN para iniciar. Se quiser que o jogo rode sem dependencias externas, baixe a versao minificada do PixiJS para dentro de `stock-markets-site/game/vendor/` e troque o `<script>` para esse arquivo local.

Se futuramente voce trocar por uma build WebGL do Unity:

1. Gere uma build WebGL no Unity.
2. Coloque os arquivos gerados dentro de `stock-markets-site/game/`.
3. Garanta que exista `stock-markets-site/game/index.html`.
4. Rode `npm run firebase:serve` para testar.
5. Rode `npm run firebase:deploy` para publicar.

Builds Unity WebGL podem gerar arquivos `.wasm`, `.data`, `.br` e `.gz`. Se isso acontecer, revise `firebase.json` para adicionar headers especificos desses tipos antes do deploy.

## Observacao sobre videos

Os videos atuais somam aproximadamente 261 MB. O Firebase Hosting serve esses arquivos, mas eles podem consumir rapidamente a cota de transferencia se muitas pessoas assistirem. Se o site receber bastante trafego, considere hospedar os videos no YouTube, Vimeo, Cloud Storage ou outro servico de video/CDN.
