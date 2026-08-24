// Dati statici del formulario di matematica (nessuna API: e' un riferimento
// rapido, sempre disponibile anche offline). Script classico: espone tutto
// su window.Schola.
(function () {

const FORMULARIO = [
  {
    key: 'algebra',
    label: 'Algebra',
    color: '#3b82f6',
    formulas: [
      { name: 'Equazione di secondo grado', expr: 'ax² + bx + c = 0  →  x = (−b ± √Δ) / 2a' },
      { name: 'Discriminante', expr: 'Δ = b² − 4ac' },
      { name: 'Somma e prodotto delle radici', expr: 'x₁ + x₂ = −b/a  x₁ · x₂ = c/a' },
      { name: 'Prodotti notevoli', expr: '(a+b)² = a² + 2ab + b²  (a−b)² = a² − 2ab + b²  (a+b)(a−b) = a² − b²' },
      { name: 'Cubo di un binomio', expr: '(a±b)³ = a³ ± 3a²b + 3ab² ± b³' },
      { name: 'Proprieta\' delle potenze', expr: 'aᵐ · aⁿ = aᵐ⁺ⁿ  aᵐ / aⁿ = aᵐ⁻ⁿ  (aᵐ)ⁿ = aᵐⁿ' },
      { name: 'Logaritmi', expr: 'log(a·b) = log a + log b  log(a/b) = log a − log b  log(aⁿ) = n·log a' },
    ],
  },
  {
    key: 'geometria',
    label: 'Geometria',
    color: '#22c55e',
    formulas: [
      { name: 'Area rettangolo', expr: 'A = b × h' },
      { name: 'Area triangolo', expr: 'A = (b × h) / 2' },
      { name: 'Area cerchio', expr: 'A = πr²' },
      { name: 'Circonferenza', expr: 'C = 2πr' },
      { name: 'Area trapezio', expr: 'A = [(B + b) × h] / 2' },
      { name: 'Area rombo', expr: 'A = (d₁ × d₂) / 2' },
      { name: 'Teorema di Pitagora', expr: 'c² = a² + b² (ipotenusa² = cateto1² + cateto2²)' },
      { name: 'Volume cubo', expr: 'V = l³' },
      { name: 'Volume parallelepipedo', expr: 'V = l × w × h' },
      { name: 'Volume cilindro', expr: 'V = πr²h' },
      { name: 'Volume sfera', expr: 'V = (4/3)πr³' },
      { name: 'Volume cono', expr: 'V = (1/3)πr²h' },
    ],
  },
  {
    key: 'trigonometria',
    label: 'Trigonometria',
    color: '#a855f7',
    formulas: [
      { name: 'Relazione fondamentale', expr: 'sin²α + cos²α = 1' },
      { name: 'Tangente', expr: 'tanα = sinα / cosα' },
      { name: 'Angoli notevoli', expr: 'sin30°=1/2 sin45°=√2/2 sin60°=√3/2 sin90°=1' },
      { name: 'Teorema dei seni', expr: 'a/sinA = b/sinB = c/sinC = 2R' },
      { name: 'Teorema del coseno', expr: 'c² = a² + b² − 2ab·cosC' },
      { name: 'Formule di addizione', expr: 'sin(α±β) = sinαcosβ ± cosαsinβ' },
    ],
  },
  {
    key: 'analisi',
    label: 'Analisi',
    color: '#06b6d4',
    formulas: [
      { name: 'Derivata di xⁿ', expr: 'D[xⁿ] = n · xⁿ⁻¹' },
      { name: 'Derivata del prodotto', expr: 'D[f·g] = f\'·g + f·g\'' },
      { name: 'Derivata del quoziente', expr: 'D[f/g] = (f\'g − fg\') / g²' },
      { name: 'Derivate notevoli', expr: 'D[sin x] = cos x D[cos x] = −sin x D[eˣ] = eˣ D[ln x] = 1/x' },
      { name: 'Integrale di xⁿ', expr: '∫xⁿ dx = xⁿ⁺¹ / (n+1) + c (n ≠ −1)' },
      { name: 'Limite notevole', expr: 'lim(x→0) sin(x)/x = 1' },
    ],
  },
  {
    key: 'fisica',
    label: 'Fisica',
    color: '#eab308',
    formulas: [
      { name: 'Velocita\'', expr: 'v = s / t' },
      { name: 'Accelerazione', expr: 'a = Δv / Δt' },
      { name: 'Moto uniformemente accelerato', expr: 's = v₀t + (1/2)at²' },
      { name: 'Secondo principio della dinamica', expr: 'F = m × a' },
      { name: 'Energia cinetica', expr: 'Ec = (1/2)mv²' },
      { name: 'Energia potenziale gravitazionale', expr: 'Ep = mgh' },
      { name: 'Lavoro', expr: 'L = F × s × cosθ' },
      { name: 'Densita\'', expr: 'ρ = m / V' },
    ],
  },
];

window.Schola = window.Schola || {};
Object.assign(window.Schola, { FORMULARIO });

})();
