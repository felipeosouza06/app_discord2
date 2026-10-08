# Discórdia

App desktop simples para conversar por voz, usar o chat e compartilhar a tela com os amigos.

- `server/`: servidor pequeno (Node + WebSocket) que junta as pessoas nas salas e repassa o chat
- `app/`: o app desktop (Electron)

O áudio e o vídeo vão **direto de um amigo pro outro** (WebRTC). O servidor só faz a apresentação e não pesa nada.

## Rodando localmente

```bash
cd server && npm install && npm start      # sobe na porta 3000
cd app && npm install && npm start         # abre o app
```

> No terminal do VS Code, rode `unset ELECTRON_RUN_AS_NODE` antes do `npm start` do app. Senão o Electron abre como se fosse Node e dá erro.

## Colocando o servidor online (grátis)

O servidor roda no plano grátis do [Render](https://render.com), usando o [render.yaml](render.yaml) deste repositório.

> **Custo zero:** não cadastre cartão no Render nem no serviço de TURN. Sem forma de pagamento cadastrada, se algum limite grátis estourar o serviço é **suspenso até o mês seguinte**, em vez de cobrado.

1. Suba este repositório para o GitHub (pode ser privado).
2. No Render, entre com a conta do GitHub e vá em **New → Blueprint**. Escolha o repositório e preencha as variáveis:
   - `PASSWORD`: a senha que os amigos digitam para entrar.
   - `TURN_URLS`, `TURN_USERNAME`, `TURN_PASSWORD`: dados do servidor TURN (veja abaixo). Pode deixar em branco e preencher depois em **Environment**.
3. O endereço do servidor fica `wss://NOME-DO-SERVICO.onrender.com`.

No plano grátis o servidor **dorme depois de 15 minutos sem ninguém** e leva até 1 minuto para acordar. O app mostra "Acordando o servidor…" e entra sozinho quando ele responde. Enquanto houver alguém na sala, o app mantém o servidor acordado.

### TURN (para quem não consegue conexão direta)

Em CGNAT, 4G e algumas redes, a conexão direta entre dois amigos não funciona e o nome fica em "conectando". O TURN repassa o áudio e o vídeo nesses casos. Ele só é usado quando a conexão direta falha.

1. Crie uma conta grátis no [Open Relay da Metered](https://www.metered.ca/tools/openrelay/) (20 GB/mês). Uma alternativa com mais cota é o [ExpressTURN](https://www.expressturn.com/).
2. Copie os endereços (`turn:...`), o usuário e a senha que o painel mostra.
3. No Render, em **Environment**, preencha `TURN_URLS` com os endereços separados por vírgula, mais `TURN_USERNAME` e `TURN_PASSWORD`.

As credenciais ficam só no servidor e são entregues a quem entra com a senha certa.

## Gerando o app pros amigos

1. Coloque o endereço do servidor em [app/renderer/config.js](app/renderer/config.js). Assim ele já vem preenchido.
2. Gere o executável:

```bash
cd app
npm run dist:win     # Windows: dist/Discordia 1.0.0.exe (portátil, não precisa instalar)
npm run dist:linux   # Linux: AppImage
```

O `.dmg` do Mac precisa ser gerado num Mac.

Como o `.exe` não é assinado, o Windows mostra o aviso do SmartScreen. É só clicar em "Mais informações" e depois em "Executar assim mesmo".

## Limitações

- **Tamanho do grupo:** cada pessoa manda o vídeo separado para cada amigo. Funciona bem até umas 5 a 6 pessoas; com mais gente, o upload de quem transmite vira o limite.
- **Cota do TURN:** uma transmissão em 1080p que passa pelo TURN gasta perto de 2 GB por hora para cada pessoa assistindo. Com 20 GB/mês, isso dá umas 10 horas para quem depende do TURN. Quando a cota acaba, só essas pessoas deixam de conectar até o mês seguinte. Quem conecta direto não gasta nada.
- **Áudio do PC na transmissão:** só funciona no Windows. Ele captura todo o som do computador, inclusive a voz dos amigos. Se eles escutarem eco, peça pra quem transmite usar fone.
