# Design QA — indicador ao vivo e chips de Entradas

- Source visual truth: `/var/folders/d0/n7r_rl_s3vl1rr4c9lv35s0c0000gn/T/TemporaryItems/NSIRD_screencaptureui_1upIrZ/Captura de Tela 2026-09-01 às 15.22.33.png`
- Implementation full view: `.design-qa/indicator-after.png`
- Implementation focused view: `.design-qa/indicator-after-focus-crop-2x.jpg`
- Viewport: `428 × 832` CSS px
- State: `#entradas`, chip ABIERTAS ativo, card UP aberto e indicador da Navbar visível
- Density normalization: source `206 × 176` px; focused implementation captured at `103 × 88` CSS px and normalized to `206 × 176` px for comparison. Browser device pixel ratio reported `2`; full-view browser captures are `428 × 832` px.

## Full-view comparison evidence

The pre-fix full view (`.design-qa/indicator-before.png`) showed the 8 px status core competing with the 10 px `LIVE` label and a pulse that could reach approximately 26 px. The revised full view keeps the three indicators visually subordinate to the chip label, LIVE metadata and Navbar icon, with no layout shift or horizontal overflow.

## Focused comparison evidence

The user crop and `.design-qa/indicator-after-focus-crop-2x.jpg` were reviewed together at the same `206 × 176` pixel size. The revised 6 px core reads as a status signal instead of a primary icon, while retaining the same red semantic color and pulse behavior.

## Findings and comparison history

- [P2, fixed] Indicator had excessive visual weight.
  - Earlier evidence: 8 px core beside 10 px LIVE text; pulse base used `inset: -5px` and scaled to `1.45`, allowing an outer diameter near 26 px.
  - Fix: core reduced to 6 px, pulse inset reduced to 3 px and final scale reduced to 1.3, limiting the outer diameter to approximately 15.6 px.
  - Post-fix evidence: chip, LIVE and Navbar all measure `6 × 6` px, use the same `1.6s` animation and preserve zero horizontal overflow.

## Required fidelity surfaces

- Fonts and typography: unchanged; LIVE remains 10 px/15 px and labels preserve their existing weights and line heights.
- Spacing and layout rhythm: existing slots and alignment are preserved; only the indicator's internal footprint was reduced.
- Colors and visual tokens: semantic error red remains `rgb(248, 113, 113)` with no contrasting border.
- Image quality and asset fidelity: no raster or icon asset is involved; this is the existing semantic live-status indicator shared by all three contexts.
- Copy and content: unchanged.

No actionable P0, P1 or P2 differences remain for this scoped indicator adjustment. No focused interaction test was needed beyond verifying the shared pulse in all three rendered contexts.

final result: passed

## Ajuste de recorte do LIVE e aparência dos chips

- Source visual truth (recorte do LIVE): `/var/folders/d0/n7r_rl_s3vl1rr4c9lv35s0c0000gn/T/TemporaryItems/NSIRD_screencaptureui_0726VR/Captura de Tela 2026-09-01 às 15.34.42.png`
- Referência de cor do chip: estado ativo de `.buy-betslip__mode-pills::before` no betslip existente.
- Implementação antes do primeiro ajuste: `.design-qa/chips-live-before.jpg`
- Primeiro ajuste com deslocamento: `.design-qa/live-position-shifted-before-correction.jpg`
- Implementação final: `.design-qa/live-position-restored-428.jpg` e `.design-qa/live-position-restored-320.jpg`
- Viewports: `428 × 832` e `320 × 568` CSS px
- Estado: `#entradas`, chip ABIERTAS ativo e card UP aberto

### Comparação e correções

- [P2, fixed] O anel pulsante era recortado pelo `overflow: hidden` da linha de metadados porque o núcleo começava exatamente no limite esquerdo dessa linha.
  - Primeiro ajuste: um slot interno de `16 × 16` px removeu o recorte, mas deslocou o núcleo de `x = 25` para `x = 30`, alterando a posição aprovada.
  - Fix final: o slot foi removido e a linha passou a permitir o overflow visual do pulso. Somente o texto da contagem regressiva mantém recorte e ellipsis para proteger a responsividade.
  - Post-fix evidence: o núcleo voltou a `x = 25`, igual ao estado original, enquanto a linha também começa em `x = 25`. O pulso completou o ciclo até a escala `1,3` sem recorte; a linha preservou `20` px de altura e o corpo manteve o padding de `8px 12px`.
- [P2, fixed] O chip ABIERTAS usava borda roxa sólida e não reproduzia o tratamento do chip ativo do betslip.
  - Fix: borda transparente com gradiente `#4b20ff → #9730ff` no `border-box`, preenchimento com o mesmo gradiente a `24%` no `padding-box` e sombra roxa a `16%`.
  - Post-fix evidence: as propriedades computadas do chip ABIERTAS correspondem às do indicador ativo do betslip; a única diferença intencional é a largura, determinada pelo conteúdo do chip.

### Responsividade

- Em `428 × 832`, o documento manteve `scrollWidth = 428`.
- Em `320 × 568`, o documento manteve `scrollWidth = 320`; o último chip termina em `x = 295,62`, dentro da viewport.
- O padding do card permaneceu `8px 12px` nos dois tamanhos; o núcleo do LIVE permaneceu em `x = 25` tanto em `428px` quanto em `320px`.

No actionable P0, P1 or P2 differences remain for this scoped clipping and chip-color adjustment.

final result: passed
