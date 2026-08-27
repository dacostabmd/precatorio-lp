# Memória de Cálculo — Avaliação de Precatórios

Documento de referência do motor de cálculo em [lib/calculator.ts](lib/calculator.ts).
Registra a metodologia, a auditoria que encontrou erros graves na fórmula de
atualização e a metodologia aprovada para substituí-la.

> **Status atual: exibição de valores calculados SUSPENSA em produção.**
> A fórmula de atualização vigente superestima o valor devido em ~2x (ver
> [Auditoria](#auditoria-da-atualização-monetária)). Até a correção entrar, a LP
> captura nome/CPF e anexa o ofício ao Bitrix, mas **não exibe valores em
> reais ao usuário**. Decisão tomada em 2026-08-03.

---

## 1. Fluxo de dados

```
Upload (PDF/JPG/PNG/WEBP)
  │
  ├─ validação de magic bytes + limite de 10 MB  ....... app/api/chat/route.ts
  ├─ anexo ao card do Bitrix (Deal, categoria 602) ..... app/api/chat/route.ts
  │
  ├─ PDF com camada de texto ──► gpt-4o-mini (texto)
  │     └─ se falhar/não ancorar ──► rasteriza p/ PNG ──► gpt-4o (visão)
  ├─ PDF escaneado ────────────► rasteriza p/ PNG ──► gpt-4o (visão)
  └─ imagem ───────────────────► gpt-4o (visão)
  │
  ├─ validarExtracao() — ancoragem no texto-fonte ...... lib/langchain.ts
  └─ executarCalculoPrecatorio() ...................... lib/calculator.ts
```

Nota: a OpenAI aceita apenas PNG/JPEG/WEBP/GIF em `image_url`; enviar
`application/pdf` retorna **HTTP 400 "Invalid MIME type"**. Por isso todo PDF
sem camada de texto é rasterizado (`getScreenshot`, escala 2x) antes da visão.

---

## 2. Motor de cálculo — 8 etapas

| # | Etapa | Fórmula |
|---|---|---|
| 1 | Atualização monetária | `valor × fatorF` (ver §3) |
| 2 | Consolidação de descontos | `PSS + outros + parciais + penhoras` (todos atualizados) |
| 3 | Líquido intermediário | `brutoAtualizado − descontos` |
| 4 | Honorários contratuais | `líquidoIntermediário × honorários%` |
| 5 | IR por RRA | tabela progressiva mensal sobre `principalTributável ÷ mesesRRA` |
| 6 | Líquido final do credor | `líquidoIntermediário − honorários − IR` |
| 7 | Percentual comercial | tabela por esfera/natureza/LOA/UF + regra da persona |
| 8 | Proposta | `limiteInterno = líquidoFinal × pct`; `propostaInicial = limiteInterno × (1 − margem)` |

### Tabela progressiva do IR (RRA), base mensal

| Base mensal até | Alíquota | Dedução |
|---|---|---|
| R$ 2.428,80 | isento | — |
| R$ 2.826,65 | 7,5% | R$ 182,16 |
| R$ 3.751,05 | 15% | R$ 394,16 |
| R$ 4.664,68 | 22,5% | R$ 675,49 |
| acima | 27,5% | R$ 908,73 |

### Percentual comercial (etapa 7)

**Federal** — Alimentar: 72% (LOA ≤2027) / 62,5% (>2027) · Comum Tributário:
69,5% / 59% · Comum: 68,5% / 57,5%

**Estadual** — SP: 30,5% (≤2026) / 25% (2027) / 20% (>2027) · RJ: 20,5% / 20,5% /
20% · BA: 31% / 25% / 25% · outros: 28% / 23% / 18%

**Municipal** — 25% (≤2026) / 20% (2027) / 15% (>2027)

**Ajuste por persona** (interno, nunca exibido ao usuário): `broker` +1 p.p.;
`advogado` +1 p.p. com piso de 70% (LOA ≤2027) ou 61% (>2027); `autor` usa a
tabela base.

---

## 3. Auditoria da atualização monetária

### 3.1 Fórmula vigente (com defeito)

[lib/calculator.ts:207](lib/calculator.ts#L207):

```ts
const fatorF = Math.pow(1 + 0.005, mesesDecorridos) * Math.pow(1 + 0.011875, mesesDecorridos);
```

Dois índices aplicados **multiplicativamente** sobre o valor bruto, com taxas
fixas, por todo o período.

### 3.2 Caso real auditado

Ofício com data-base **18/02/2020**, cálculo em **08/2026** → 78 meses.

Dados do ofício:

| Campo | Valor |
|---|---|
| Valor bruto original | R$ 1.059.599,54 |
| ├─ Valor Principal | R$ 439.086,98 |
| └─ Valor Juros | R$ 620.512,56 (58,6% do bruto) |
| Correção monetária | R$ 0,00 |
| Desconto previdenciário (PSS) | R$ 19.093,91 |
| Incide IR | sim |
| Período dos pagamentos pleiteados | 05/1990 a 04/2013 |

Conferência de consistência: `439.086,98 + 620.512,56 = 1.059.599,54` ✓

### 3.3 Resultado da fórmula vigente

| Componente | Fator |
|---|---|
| Juros de mora 0,5%/mês → `1,005^78` | 1,47555 |
| "SELIC" fixa 1,1875%/mês → `1,011875^78` | 2,51128 |
| **fatorF (produto)** | **3,70551** |

→ Valor atualizado: **R$ 3.926.360,15**
→ Taxa composta equivalente: **22,32% a.a.**

### 3.4 Comparação com a SELIC real acumulada

SELIC acumulada aproximada por ano-calendário (02/2020 → 08/2026): 2,76% ·
4,42% · 12,40% · 13,00% · 10,88% · ~14% · ~8,5% (parcial).

| | Fator | Valor atualizado |
|---|---|---|
| Fórmula vigente | 3,70551 | R$ 3.926.360 |
| SELIC real acumulada | ~1,86913 | R$ 1.980.533 |
| **Divergência** | **~1,98x** | **+R$ 1.945.827** |

### 3.5 Impacto na proposta comercial

Simulação (Estadual RJ, LOA 2027 → 20,5%, PSS R$ 19.093,91, sem honorários/IR):

| | Líquido | Teto da proposta |
|---|---|---|
| Fórmula vigente | R$ 3.855.607 | **R$ 790.400** |
| SELIC real | R$ 1.944.844 | **R$ 398.693** |

A LP autorizaria abertura de proposta com **~2x** o valor devido.

---

## 4. Os três defeitos identificados

### Defeito 1 — dois índices somados (juros sobre juros)

A fórmula aplica juros de mora 0,5%/mês **e** SELIC, multiplicados. A
**EC 113/2021, art. 3º** determina a incidência da SELIC **"uma única vez"**,
abrangendo *atualização monetária + remuneração do capital + compensação da
mora*. Somar 0,5%/mês de mora por cima duplica o componente de mora que a SELIC
já contém — e essa duplicação incide sobre uma base que já embute
R$ 620.512,56 de juros apurados no processo original (1990–2020).

### Defeito 2 — SELIC como constante fixa (maior culpado numérico)

Não existe série histórica de SELIC no projeto: é o literal `0.011875`
(~15,2% a.a.) composto por 78 meses. A SELIC real foi **2% a.a. em 2020**. A EC
113/2021 exige a SELIC **"acumulado mensalmente"** — a série real, não uma taxa
média arbitrária.

### Defeito 3 — IR zerado apesar de "Incide IR" — CORRIGIDO

O ofício informa incidência de IR e traz o split principal/juros, mas a extração
devolvia `principalTributavel: 0` e `mesesRra: 0`, resultando em **IR = R$ 0,00**.

Corrigido: `principalTributavel` passou a ser extraído do item **XX (Valor
Principal)** e `mesesRra` é **derivado em código** (`derivarMesesRra`) a partir
do período de competência do item **VII**, porque LLM erra contagem de
calendário e um erro ali muda a faixa da tabela progressiva. Resultado no caso
auditado: **IR = R$ 35.722,31** (276 meses).

> **Os três defeitos empurram a proposta para cima** — risco comercial direto,
> não erro cosmético.

### Diagnóstico incorreto que foi descartado

Foi levantada a hipótese de aplicar a correção **somente sobre o Principal**
(R$ 439.086,98), deixando os juros de fora. **Isso está errado.** Consolidado o
débito na data-base, o valor inteiro — principal + juros já apurados — é dívida
em dinheiro sujeita à perda de valor pela inflação. Corrigir só o principal
congelaria R$ 620.512,56 por mais de 6 anos, **subcompensando o credor**.

O anatocismo vedado é aplicar **novos juros de mora sobre base que já contém
juros** — ou seja, o fator `1,005^m` do Defeito 1 — e não a correção monetária
do valor consolidado.

---

## 5. Metodologia aprovada (IMPLEMENTADA)

Atualização **por trecho**, respeitando a mudança de regime da EC 113/2021:

```
data-base ──────────► 12/2021 : IPCA-E (correção) + juros de mora 0,5%/mês
          12/2021 ──────────► pagamento : SELIC acumulada (uma única incidência)
```

Fundamento: até a EC 113/2021 vigia o regime do **Tema 810/STF (RE 870947)** —
IPCA-E para correção monetária e juros de mora à parte. A partir da EC 113/2021,
a SELIC substitui ambos e incide uma única vez.

### Implementação

[lib/indices.ts](lib/indices.ts) — obtém as séries mensais reais da **API SGS do
Banco Central** (pública, sem autenticação), com cache em memória de 6 h:

| Série SGS | Conteúdo |
|---|---|
| **4390** | SELIC acumulada no mês (% a.m.) |
| **10764** | IPCA-15 / IPCA-E, variação mensal (% a.m.) — idêntica à série 7478 |

O fator agora é **injetado** em `executarCalculoPrecatorio(params, fatorF)`. O
motor não tem mais nenhuma fonte de índice embutida, então é impossível voltar a
estimar taxa por acidente.

**Se as séries não estiverem acessíveis, a análise falha** com mensagem ao
usuário — não existe fallback para taxa estimada. Foi precisamente o fallback
silencioso que gerou o erro de ~2x.

### Resultado validado — caso auditado (data-base 02/2020 → 08/2026)

| Trecho | Período | Meses | Fator |
|---|---|---|---|
| IPCA-E (correção) | 03/2020 → 11/2021 | 21 | 1,13147 |
| Juros de mora 0,5%/mês (simples) | 03/2020 → 11/2021 | 21 | 1,10500 |
| SELIC isolada | 12/2021 → 08/2026 | 57 | 1,75490 |
| **fatorF total** | | **78** | **2,19411** |

| | Fórmula antiga | Fórmula nova |
|---|---|---|
| fatorF | 3,70551 | **2,19411** |
| Valor atualizado | R$ 3.926.360,15 | **R$ 2.324.873,05** |
| | | **−40,8%** |

Cálculo completo do ofício real, já com o IR alimentado (`principalTributavel`
R$ 439.086,98, `mesesRra` 276 = 05/1990–04/2013):

| Etapa | Valor |
|---|---|
| Bruto atualizado | R$ 2.324.873,05 |
| PSS atualizado | R$ 41.894,05 |
| Líquido intermediário | R$ 2.282.979,00 |
| IR por RRA | R$ 35.722,31 (era R$ 0,00) |
| Líquido final do credor | R$ 2.247.256,70 |
| Percentual comercial (RJ, LOA 2027) | 20,5% |
| **Teto da proposta** | **R$ 460.687,62** (era R$ 790.400) |
| Proposta inicial (margem 5%) | R$ 437.653,24 |

### Ramos validados

| Cenário | Resultado |
|---|---|
| Data-base 02/2020 (pré + pós EC 113) | fator 2,19411 — ambos os trechos aplicados |
| Data-base 01/2022 (só pós EC 113) | fator 1,72887 em 55 meses — só SELIC |
| Data-base = mês do cálculo | fator 1,0 · 0 meses (nada a atualizar) |

### Pendências

- [ ] **Validação jurídica das premissas** (a), (b) e (c) listadas no cabeçalho
      de [lib/indices.ts](lib/indices.ts) — juros de mora simples, competência
      inicial de incidência e marco de 12/2021.
- [ ] **Definir a regra comercial da preferência constitucional** (ver §7).
- [ ] Reativar `EXIBIR_VALORES_CALCULADOS` em
      [components/ChatSection.tsx](components/ChatSection.tsx) após a validação
      jurídica.
- [x] Alimentar `principalTributavel` e `mesesRra` (Defeito 3).
- [x] Distinguir na UI o que foi lido do documento e o que foi calculado
      (`validarExtracao` + marcadores de status nos cards).

---

## 6. Extração — mapeamento do ofício requisitório

Ofícios de TJ/TRF trazem os dados em itens romanos. Mapeamento implementado no
prompt de extração e validado contra o ofício real (TJRJ, 3 páginas):

| Item | Conteúdo | Campo |
|---|---|---|
| — (título) | "PAGAMENTO DE VERBA ALIMENTAR" | `natureza` |
| — (cabeçalho) | "Estado do Rio de Janeiro" / "TJERJ" | `uf`, `esfera` |
| I | número do processo de execução | `processo` |
| II | **Autor** = credor · Réu = devedor · Procurador = advogado | `credor`, `enteDevedor` |
| III | natureza da obrigação (assunto) | ⚠️ **ignorado** — é o rito, não a natureza |
| VII | Pagamentos pleiteados na ação (05/1990 a 04/2013) | `periodoPagamentos*` → `mesesRra` |
| VIII | "Não é Tributário" | `isTributario` |
| X | nome e CPF do beneficiário | `credor`, `cpfCnpj` |
| XII | **Data de nascimento**, doença grave, PcD | `dataNascimento`, `portadorDoencaGrave`, `pessoaComDeficiencia` |
| XIV | tipo de requisição | `tipoRequisicao` |
| XV | valor bruto da requisição + data-base | `brutoOriginal`, `dataBase` |
| XVI | valor do desconto previdenciário | `pssOriginal` |
| XVIII | "Incide IR" | `incideIr` |
| XX / XXI / XXII | Valor Principal / Juros / Correção Monetária | `principalTributavel`, `valorJuros`, `correcaoMonetaria` |

### Armadilhas reais do documento

**1. Natureza.** O item III diz *"Procedimento Comum - Revisão"* — isso é o
**rito processual**. O crédito é **Alimentar**, conforme o título do ofício, o
item XIII (Pensionista Civil) e o item VIII. A extração original classificava
como "Comum". O prompt agora usa o título e ignora o item III.

**2. UF.** Não aparece como sigla em lugar nenhum — só como "Estado do Rio de
Janeiro" e "TJERJ". Sem ela, o fallback `'SP'` aplicaria a tabela de São Paulo
(25% na LOA 2027) a um precatório do RJ (20,5%) — **erro de 4,5 p.p. na
proposta**. Resolvido no prompt e com `derivarUf()` como defesa em profundidade.

**3. Contagem de meses.** `mesesRra` é derivado em código, não pelo LLM.

### Campos que nunca constam em ofício

| Campo | Tratamento |
|---|---|
| `loa` | Fica em `camposAssumidos`. O ofício é uma "Prévia" de 2021 sem LOA declarada. O prompt é instruído a **não** inferir a partir das datas de trânsito. |
| `honorariosPct` | Contrato privado credor↔advogado. Assume 15% (marcado como assumido) e o chat passa a **perguntar** ao usuário. Assumir 0% seria pior: inflaria o líquido e a proposta. |

### Resultado validado (ofício real da CECILIA)

Todos os campos conferidos contra o PDF original:

```
credor              CECILIA ARANHA DE MACEDO     natureza     Alimentar  (era "Comum")
cpfCnpj             082.545.407-72               esfera / uf  Estadual / RJ
processo            0171043-76.1995.8.19.0001    bruto        R$ 1.059.599,54
principalTributavel R$ 439.086,98  (era 0)       dataBase     18/02/2020
valorJuros          R$ 620.512,56                pss          R$ 19.093,91
periodo             1990-05 a 2013-04            mesesRra     276  (derivado)
incideIr            true                         isTributario false
dataNascimento      1922-07-05                   preferencia  idosa, 104 anos
loa                 (ausente — assumido)         honorarios   (ausente — assumido)

IR por RRA          R$ 35.722,31   (era R$ 0,00)
pct comercial       20,5%          (RJ correto, não 25% de SP)
```

Consistência conferida automaticamente: `439.086,98 + 620.512,56 + 0,00 =
1.059.599,54` ✓ — divergência acima de 1% marca `composicaoValores` como
suspeito e dispara releitura por visão.

---

## 7. Preferência constitucional — pendente de regra comercial

O item XII do ofício informa **data de nascimento 05/07/1922**: a credora tem
**104 anos**, o que lhe dá **preferência no pagamento pelo §2º do art. 100 da
CF** (idosos, portadores de doença grave e pessoas com deficiência).

Isso é economicamente relevante: preferência significa fila prioritária, prazo
menor, risco menor — logo, desconto menor. Um precatório com preferência de
idoso não vale o mesmo que um sem preferência.

**Situação atual:** a preferência é **detectada e reportada**
(`avaliarPreferencia` → `{temPreferencia, idade, motivos}`, exibida no card com
selo "prioridade"), mas **não altera o percentual comercial**.
`obterPercentualComercial()` recebe apenas `(esfera, natureza, loa, uf, persona)`.

**Falta definir:** quanto a preferência vale em pontos percentuais na tabela, e
se doença grave / PcD valem o mesmo que idade. É decisão comercial, não técnica.

### Observação adicional sobre a tabela

Em `obterPercentualComercial`, a `natureza` só é considerada no ramo **Federal**.
Para Estadual e Municipal ela é ignorada — RJ devolve 20,5% seja Alimentar ou
Comum. Como crédito alimentar tem precedência na fila do art. 100, isso parece
lacuna e não escolha deliberada. **A confirmar.**

---

## 8. Registro de decisões

| Data | Decisão |
|---|---|
| 2026-08-03 | Metodologia aprovada: por trecho (IPCA-E + juros até 11/2021, SELIC de 12/2021). |
| 2026-08-03 | Exibição de valores calculados suspensa na LP até a correção entrar. |
| 2026-08-03 | Descartada a proposta de corrigir apenas o Principal (subcompensaria o credor). |
| 2026-08-03 | Metodologia por trecho implementada em `lib/indices.ts` com séries reais do BCB; fator do caso auditado caiu de 3,70551 para 2,19411 (−40,8%). Aguarda validação jurídica das premissas antes de reativar a exibição. |
| 2026-08-03 | Removida a branch de "demonstração" em `/api/chat` — disparava com a palavra "exemplo" e expunha o percentual da tabela comercial por perfil, os nomes das etapas internas e as taxas da fórmula. |
| 2026-08-03 | Extração ampliada com os campos do ofício real (principal, juros, PSS, CPF, processo, período de competência, IR, preferência). Armadilha da natureza ("Procedimento Comum" no item III) e derivação da UF resolvidas. |
| 2026-08-03 | Preferência constitucional passa a ser detectada e exibida, mas **não** altera o percentual comercial — pendente de definição da regra de negócio (§7). |
