# Wizard de orçamento conversacional — design

**Data:** 2026-07-21
**Status:** implementado e verificado manualmente

## Contexto

O site (`devcaiquesilva.github.io`) já tem uma página de orçamento (`orcamento.html`) funcional: formulário único com grid de 8 tipos de projeto, descrição livre, prazo, faixa de investimento (select), dados de contato, envio via FormSubmit com fallback para WhatsApp em caso de erro.

O objetivo desta mudança não é consertar algo quebrado — é usar a própria experiência de pedir orçamento como demonstração de que "a experiência com o Caique é diferente e personalizada". Hoje o formulário é padrão e genérico; a ideia é que ele vire, em si, uma prova de UX bem cuidado, já que o cliente ainda não tem depoimentos/casos para se basear.

## Objetivo

Substituir o formulário estático de `orcamento.html` por um **wizard conversacional**: uma pergunta por tela, com perguntas que mudam de acordo com o tipo de projeto escolhido, e um resumo do briefing se construindo ao vivo conforme o cliente responde.

## Fora de escopo (explicitamente adiado)

- Faixa de preço estimada em tempo real (calculadora de orçamento) — depende de o Caique definir preços por categoria; fica para uma iteração futura.
- Depoimentos / prova social — não há material ainda.
- Instagram e anúncios locais — frente separada, não faz parte desta spec.
- Mudança de identidade visual do restante do site (`index.html`, `projetos.html`, etc.) — só `orcamento.html` muda.

## Onde vive

O wizard substitui o conteúdo de `orcamento.html` (mesma URL). Não há página nova — preserva SEO, meta tags e todos os links de navegação (`nav-cta`, `service-card`, `page-cta`, footer) que já apontam para `orcamento.html`.

## Fluxo de telas

```
1. Tipo de projeto        → 7 cards em tela cheia (grid), 1 seleção obrigatória
2. Pergunta A do branch    → específica do tipo escolhido
3. Pergunta B do branch    → específica do tipo escolhido
4. Descrição livre         → "me conta com suas palavras" (textarea, igual ao atual)
5. Prazo                   → mesmas 4 opções atuais, como cards de seleção única
6. Investimento            → slider arrastável (ver seção própria)
7. Contato                 → nome, WhatsApp, e-mail (opcional) — única tela com 3 campos juntos
8. Revisão final           → mostra o resumo completo lado a lado com botão de enviar
9. Sucesso                 → mantém a tela atual (mensagem + link direto pro WhatsApp)
```

Navegação: botão "Próximo" avança (desabilitado até responder), "Voltar" retorna sem perder o que já foi preenchido. Tecla Enter também avança quando o campo atual é válido.

A tela 1 ("Ainda não sei") pula direto para a tela 4 (descrição livre), sem passar pelas telas 2 e 3 — não existem perguntas de branch para essa opção.

## Tipos de projeto e perguntas de branch

Removida a opção "Automação com IA" (ficam 7 tipos). Cada tipo tem duas perguntas de múltipla escolha específicas:

| Tipo | Pergunta A | Pergunta B |
|---|---|---|
| 🏢 Site institucional | Já tem site hoje? (Não tenho / Tenho mas está ultrapassado / Quero uma versão nova) | O que é mais importante? (Passar profissionalismo / Aparecer no Google / Ter formulário de contato) |
| 👤 Site pessoal | Qual o objetivo principal? (Currículo/carreira / Mostrar meu trabalho / Marca pessoal e conteúdo) | Já tem fotos e textos prontos, ou precisa de ajuda para organizar isso também? (Já tenho tudo pronto / Tenho parte / Preciso de ajuda) |
| 🛒 Loja virtual | Quantos produtos pretende vender? (Até 10 / 10 a 50 / 50 a 200 / Mais de 200) | Como vai receber pagamento? (Cartão/Pix direto no site / Combinar por WhatsApp / Ainda não sei) |
| 📣 Landing page | Qual ação você quer que a pessoa faça? (Preencher formulário / Comprar direto / Agendar uma conversa / Baixar algo) | Já tem uma campanha de anúncio rodando ou planejada para essa página? (Sim, já rodando / Estou planejando / Ainda não) |
| 📱 Aplicativo | Para quais plataformas? (Só Android / Só iOS / Ambos) | Vai precisar de login e conta de usuário? (Sim / Não / Não sei) |
| ⚙️ Sistema/plataforma | Quantas pessoas vão usar no dia a dia? (Só eu / Minha equipe / Múltiplos clientes/empresas) | Já existe algo hoje (planilha, outro sistema) que isso vai substituir? (Sim / Não, é novo / Mais ou menos) |
| 💡 Ainda não sei | — pula direto para a descrição livre — | |

Cada resposta de branch entra no e-mail final como um campo próprio (ex: `Quantos produtos: 10 a 50`), igual aos campos já existentes hoje.

## Resumo ao vivo ("seu briefing até agora")

**Desktop:** coluna lateral fixa ao lado do wizard, mostrando o que já foi respondido, se atualizando a cada tela. Continua visível (e completo) na tela 8 de revisão final, antes do envio.

**Mobile:** vira um chip recolhível no topo ("Ver meu briefing ▾") que expande ao toque, já que não há espaço para coluna lateral.

Implementação: div atualizada via JS a cada mudança de estado do wizard, sem re-render de página.

## Slider de investimento

Substitui o `<select>` atual por um range slider (`<input type="range">` customizado ou equivalente) cobrindo **R$ 500 a R$ 10.000+**. O valor máximo é rotulado "R$ 10.000+" (não trava em 10.000 — comunica "isso ou mais"). O valor arrastado aparece em destaque acima da barra (ex: "R$ 3.200"). Passo sugerido: R$ 100.

Valor enviado no e-mail como texto simples (ex: `Investimento: R$ 3.200`).

## Visual

Mantém a identidade visual atual do site: tema claro, azul e azul-claro (`#1a6ef5` e tons mais claros), fontes Baloo 2 (títulos) + Nunito (corpo), glows suaves. O que muda é o *padrão de interação e o tom*, não a paleta: cantos bem arredondados, sombras suaves, emojis grandes nos cards de tipo de projeto, cards com destaque azul quando selecionados (borda + sombra colorida), barra de progresso fina no topo do card do wizard indicando quantas telas faltam.

## Envio de dados

Mantém a lógica atual de `main.js`: ao confirmar na tela de revisão, `fetch` para `https://formsubmit.co/ajax/8bccbc0af1756383496ac8812fae2780` com todos os campos (fixos + de branch), mesmo fallback automático para WhatsApp (mensagem pré-formatada) se o envio falhar, mesma tela de sucesso. O e-mail continua chegando em formato tabela (`_template: table`), agora com as perguntas de branch como linhas extras.

## Progresso salvo

As respostas de cada tela são salvas em `localStorage` conforme o cliente avança. Se a aba for fechada ou recarregada antes de enviar, o wizard restaura o progresso na próxima visita (mesmo dispositivo/navegador). O `localStorage` é limpo após envio bem-sucedido.

## Acessibilidade e sem JavaScript

- Navegação por teclado entre telas (Tab entre opções, Enter para avançar quando válido).
- Resumo lateral usa `aria-live="polite"` para leitores de tela acompanharem as atualizações.
- Cards de seleção mantêm `<input type="radio">`/`<input type="checkbox">` reais por baixo (como hoje), não apenas divs clicáveis, preservando semântica e navegação por teclado.
- Se o JavaScript não carregar, uma mensagem substitui o wizard incentivando contato direto via WhatsApp (fallback simples via `<noscript>`, já que o wizard depende inteiramente de JS para funcionar — diferente do restante do site, que hoje só usa JS para animação).

## Testes manuais antes de considerar pronto

- Preencher o wizard do início ao fim para cada um dos 7 tipos de projeto, conferir que as perguntas de branch aparecem corretas.
- Conferir que "Ainda não sei" pula as telas de branch.
- Recarregar a página no meio do preenchimento e confirmar que o progresso é restaurado.
- Testar em viewport mobile (resumo vira chip).
- Desligar JavaScript e confirmar que aparece o aviso de fallback, sem tela em branco.
- Simular falha de envio (endpoint incorreto) e confirmar que o fallback de WhatsApp monta a mensagem com os campos de branch incluídos.
