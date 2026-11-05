const width = window.innerWidth;
const height = window.innerHeight;

const draw = SVG().addTo('#app').size('100%', '100%');

// Lähtöpiste keskelle
let x = width / 2;
let y = height / 2;

// Tallennetaan viivan historia
let points = [[x, y]];

// Piirretään viiva
const trace = draw
  .polyline(points)
  .fill('none')
  .stroke({
    color: '#ffffff',
    width: 2,
    linecap: 'round',
    linejoin: 'round'
  });

// Pieni hehkuva piste viivan kärkeen
const head = draw
  .circle(8)
  .fill('#ffffff')
  .center(x, y);

// Pehmeä taustahohde
const glow = draw
  .circle(22)
  .fill('#ffffff')
  .opacity(0.12)
  .center(x, y);

// Liikkeen suunta
let angle = Math.random() * Math.PI * 2;
let speed = 1.2;

// Maksimimäärä pisteitä "muistissa"
const maxPoints = 220;

function step() {
  // Suunta muuttuu vähän koko ajan
  angle += (Math.random() - 0.5) * 0.35;

  // Hidas orgaaninen liike
  x += Math.cos(angle) * speed;
  y += Math.sin(angle) * speed;

  // Reunoista kimpoaminen
  if (x < 20 || x > width - 20) {
    angle = Math.PI - angle;
  }
  if (y < 20 || y > height - 20) {
    angle = -angle;
  }

  // Pidetään varmasti näkymän sisällä
  x = Math.max(20, Math.min(width - 20, x));
  y = Math.max(20, Math.min(height - 20, y));

  // Lisätään uusi piste
  points.push([x, y]);

  // Unohdetaan vanhimmat pisteet
  if (points.length > maxPoints) {
    points.shift();
  }

  // Päivitetään viiva
  trace.plot(points);

  // Päivitetään kärkipiste
  head.center(x, y);
  glow.center(x, y);

  requestAnimationFrame(step);
}

step();
