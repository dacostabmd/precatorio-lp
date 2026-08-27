# 🚀 Documentação de Features e Integrações — LP Premium Office Precatório

Documento consolidado de todas as implementações, integrações de APIs e melhorias de inteligência de dados desenvolvidas para a Landing Page da **Premium Office / DAP Advocacia**.

---

## 1. 🪪 Coleta e Validação Inteligente de CPF
* **Substituição de Telefone por CPF**: O fluxo de qualificação e cadastro de leads agora coleta o CPF do titular/advogado/broker.
* **Máscara Dinâmica em Tempo Real**: Formatação automática no padrão `000.000.000-00` enquanto o usuário digita.
* **Validação por Dígito Verificador (Algoritmo Oficial da Receita Federal)**:
  - Checagem matemática dos dois dígitos verificadores no cliente e no servidor.
  - Bloqueio de CPFs inválidos ou sequências repetidas (`111.111.111-11`, etc.).
* **Prompt da IA Conversacional**: A IA solicita e valida o CPF antes de pedir o arquivo do ofício.

---

## 2. 🏛️ Consulta Automática em Tribunais via InfoSimples API
* **Busca Paralela nos Principais Tribunais**:
  - **TRF-1** (DF, GO, MT, BA, etc. - Federal)
  - **TRF-2** (RJ e ES - Federal)
  - **TRF-3** (SP e MS - Federal)
  - **TRF-5** (Nordeste - Federal)
  - **TRF-6** (Minas Gerais - Federal)
  - **TJSP** (São Paulo - Estadual)
  - **TJMG** (Minas Gerais - Estadual)
* **Extração Completa de Dados Processuais**:
  - Número oficial do Processo CNJ (ex: `0031645-45.2004.8.26.0053`).
  - Classe judicial (ex: *Cumprimento de Sentença contra a Fazenda Pública*, *Execução Fiscal*).
  - Assunto e Vara/Foro (ex: *10ª Vara de Fazenda Pública - Foro Central*).
  - Valor da Causa / Execução (ex: *R$ 18.000,00*).
  - Partes (Exequente / Executado / Advogados).
  - **Histórico e Última Movimentação Oficial** (ex: *`Processo suspenso em razão de expedição de precatório`*).
* **Identificação Automática de Precatórios**: Algoritmo inteligente que identifica se o processo é contra a Fazenda Pública, IPESP, União, INSS ou possui expedição de precatório/RPV.
* **Detecção de Segredo de Justiça / Peça Restrita**: Tratamento de respostas restritas (Código `620`) para orientar o envio do PDF como fallback.

---

## 3. 🏢 Integração Completa com o CRM Bitrix24
* **Criação de Contato e Negócio (Deal) em Categoria Alvo**: Pipeline `[LP] PREMIUM OFFICE v2` (Categoria `534`, Estágio `C534:NEW`).
* **Capa do Card Otimizada para o Kanban**:
  - `TITLE`: Nome do cliente + Precatório do Tribunal + CPF visível no Kanban (ex: `Renata Rizzo - Precatório TJSP (363.637.368-46)`).
* **Mapeamento de 100% dos Campos Visíveis no Card**:
  - `[S] Nome Completo/Razão Social do cliente` (`UF_CRM_1703254259078`): Nome do titular.
  - `[S] CPF/CNPJ DO CLIENTE` (`UF_CRM_1703254224613`): CPF formatado.
  - `[S] Número do Processo` (`UF_CRM_1705005770426`): Número CNJ do precatório principal.
  - `[+] Estado` (`UF_CRM_1702986393274`): Enumeração do Estado (SP, RJ, MG, DF, etc.).
  - `[MKT] Estado` (`UF_CRM_1767120845991`): Sigla do estado do tribunal.
  - `[+] INFORMAÇÕES EXTRAS` (`UF_CRM_1702986695`): Resumo detalhado com classe, vara, partes, valor e última movimentação.
  - `[P] VALOR DESEJADO PELO CLIENTE` (`UF_CRM_1736172629`): Valor da causa / crédito do cliente em texto formatado.
  - `[P] TIPO DE PRECATORIO` (`UF_CRM_1756758368`): Enumeração (`FEDERAL`, `ESTADUAL`, `MUNICIPAL`).
  - `[P] TRIBUNAL FEDERAL` (`UF_CRM_1767021573716`): Enumeração (`TRF1`, `TRF2`, `TRF3`, `TRF4`, `TRF5`, `TRF6`).
  - `[P] TRIBUNAL ESTADUAL` (`UF_CRM_1767037264990`): Enumeração (`TJSP`, `TJRJ`, `TJMG`, `TJRS`, etc.).
  - `[LP] PRECATÓRIOS` (`UF_CRM_1772054165226`): Enumeração do pipeline de precatórios.
  - `OPPORTUNITY`: Valor numérico da oportunidade em BRL.
* **Histórico Detalhado em Comentários (`COMMENTS`)**: Relatório com todos os processos encontrados, varas, valores, partes e últimas movimentações.
* **Atualizações de Fluxo em Tempo Real (`/api/lead/update`)**:
  - Gravação dos valores da proposta calculada pela IA.
  - Gravação de agendamento de reuniões com data e horário.
  - Notificação de transição de status (Aceitou proposta, Pediu revisão, Optou por WhatsApp).

---

## 4. ⚡ Fluxo Não-Bloqueante e Chat Livre com a IA
* **Zero Espera na Submissão**: Ao enviar o Nome e CPF, a resposta da IA é imediata (0ms), liberando o chat na hora.
* **Consulta Assíncrona em Segundo Plano**: A busca nos tribunais e o envio ao Bitrix rodam em background.
* **Conversação Ativa a Qualquer Momento**: O usuário pode tirar dúvidas livremente com a IA sobre precatórios (regras, prazos, deságio, cessão) através da caixa de texto sem travar a navegação.
* **Sincronização Silenciosa**: Quando os dados dos tribunais chegam, o estado é atualizado e o usuário recebe um aviso discreto no chat.

---

## 5. 🎯 Rastreamento e Atribuição de Marketing (UTMs)
* **Captura Automática de Parâmetros na URL**:
  - `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `gclid`, `fbclid`, `referrer`.
* **Persistência em `sessionStorage`**: Garante que o lead não perca a atribuição de origem se navegar ou atualizar a página.
* **Preenchimento nos Campos Nativos do Bitrix**:
  - `UTM_SOURCE`, `UTM_MEDIUM`, `UTM_CAMPAIGN`, `UTM_CONTENT`, `UTM_TERM`.
* **Meta Conversions API (CAPI)**: Envio do evento `Lead` com identificador `external_id` (SHA-256 do CPF) e `eventId` vinculado ao Deal do Bitrix.

---

## 5. 🔬 Modal de Diagnóstico e Depuração (Ambiente DEV)
* **Abertura Automática ao Finalizar o Fluxo**: Abre assim que a simulação conclui em ambiente de desenvolvimento (`process.env.NODE_ENV === 'development'`).
* **Botão Flutuante Exclusivo de DEV**: Botão no canto inferior esquerdo para reabrir o modal a qualquer momento.
* **Abas Interativas**:
  1. **📊 Resumo Geral**: Métricas de processos encontrados, restrições e tempo de resposta da API.
  2. **🎯 Processos**: Cards visuais com destaque verde para Precatórios, número CNJ, vara, partes e movimentação recente.
  3. **🏛️ Tribunais**: Status e latência individual de cada TRF e TJ consultado.
  4. **⚡ JSON Bruto**: Payload completo da InfoSimples com botão **"Copiar JSON"**.

---

*Documentação gerada em 27/08/2026.*
