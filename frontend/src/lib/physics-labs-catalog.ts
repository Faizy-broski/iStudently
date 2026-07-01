export type SimCategory =
  | 'Pendulums'
  | 'Springs'
  | 'Collisions'
  | 'Roller Coasters'
  | 'Orbital'
  | 'Waves'
  | 'Other'

export interface SimulationMeta {
  key: string
  title: string
  description: string
  category: SimCategory
  url: string
  topics: string[]
}

export const SIM_CATEGORIES: SimCategory[] = [
  'Pendulums',
  'Springs',
  'Collisions',
  'Roller Coasters',
  'Orbital',
  'Waves',
  'Other',
]

export const PHYSICS_CATALOG: SimulationMeta[] = [
  // ── Pendulums ──────────────────────────────────────────────────────────────
  {
    key: 'single-pendulum',
    title: 'Single Pendulum',
    description: 'Classic pendulum showing simple harmonic motion, gravity, and period.',
    category: 'Pendulums',
    url: 'https://www.myphysicslab.com/pendulum/pendulum-en.html',
    topics: ['pendulum', 'oscillation', 'gravity', 'simple harmonic motion'],
  },
  {
    key: 'double-pendulum',
    title: 'Double Pendulum',
    description: 'Two pendulums linked together exhibiting chaotic motion.',
    category: 'Pendulums',
    url: 'https://www.myphysicslab.com/pendulum/double-pendulum-en.html',
    topics: ['pendulum', 'chaos', 'oscillation', 'nonlinear dynamics'],
  },
  {
    key: 'chaotic-pendulum',
    title: 'Chaotic Pendulum',
    description: 'A driven pendulum demonstrating sensitivity to initial conditions.',
    category: 'Pendulums',
    url: 'https://www.myphysicslab.com/pendulum/chaotic-pendulum-en.html',
    topics: ['pendulum', 'chaos', 'driven oscillation', 'resonance'],
  },
  {
    key: 'inverted-pendulum',
    title: 'Inverted Pendulum',
    description: 'Balancing an unstable pendulum upright.',
    category: 'Pendulums',
    url: 'https://www.myphysicslab.com/pendulum/inverted-pendulum-en.html',
    topics: ['pendulum', 'stability', 'control', 'equilibrium'],
  },
  {
    key: 'moveable-pendulum',
    title: 'Moveable Pendulum',
    description: 'Pendulum mounted on a cart that can move freely.',
    category: 'Pendulums',
    url: 'https://www.myphysicslab.com/pendulum/moveable-pendulum-en.html',
    topics: ['pendulum', 'cart', 'coupled motion'],
  },
  {
    key: 'pendulum-clock',
    title: 'Pendulum Clock',
    description: 'Mechanical clock regulated by an escapement and swinging pendulum.',
    category: 'Pendulums',
    url: 'https://www.myphysicslab.com/engine2D/pendulum-clock-en.html',
    topics: ['pendulum', 'clock', 'escapement', 'mechanism'],
  },
  {
    key: 'compare-pendulum',
    title: 'Compare Pendulums',
    description: 'Side-by-side comparison of pendulums with different lengths and conditions.',
    category: 'Pendulums',
    url: 'https://www.myphysicslab.com/pendulum/compare-pendulum-en.html',
    topics: ['pendulum', 'comparison', 'period', 'length'],
  },
  {
    key: 'cart-pendulum',
    title: 'Cart + Pendulum',
    description: 'Pendulum attached to a cart rolling on a frictionless track.',
    category: 'Pendulums',
    url: 'https://www.myphysicslab.com/pendulum/cart-pendulum-en.html',
    topics: ['pendulum', 'cart', 'coupled motion', 'conservation of momentum'],
  },

  // ── Springs ────────────────────────────────────────────────────────────────
  {
    key: 'single-spring',
    title: 'Single Spring',
    description: 'A mass on a spring showing Hooke\'s law and SHM.',
    category: 'Springs',
    url: 'https://www.myphysicslab.com/spring/single-spring-en.html',
    topics: ['spring', 'Hooke\'s law', 'simple harmonic motion', 'oscillation'],
  },
  {
    key: 'double-spring',
    title: 'Double Spring',
    description: 'Two masses connected by springs, showing coupled oscillations.',
    category: 'Springs',
    url: 'https://www.myphysicslab.com/spring/double-spring-en.html',
    topics: ['spring', 'coupled oscillation', 'normal modes'],
  },
  {
    key: 'spring-2d',
    title: '2D Spring',
    description: 'A mass bouncing on a spring in two dimensions.',
    category: 'Springs',
    url: 'https://www.myphysicslab.com/spring/spring-2d-en.html',
    topics: ['spring', '2D motion', 'oscillation'],
  },
  {
    key: 'double-spring-2d',
    title: 'Double 2D Spring',
    description: 'Two connected springs in 2D showing coupled 2D oscillations.',
    category: 'Springs',
    url: 'https://www.myphysicslab.com/spring/double-2d-spring-en.html',
    topics: ['spring', '2D', 'coupled oscillation'],
  },
  {
    key: 'molecule2',
    title: 'Molecule (2 atoms)',
    description: 'Two-atom molecular simulation with spring-like intermolecular forces.',
    category: 'Springs',
    url: 'https://www.myphysicslab.com/spring/molecule2-en.html',
    topics: ['molecule', 'spring', 'potential energy', 'intermolecular forces'],
  },
  {
    key: 'molecule3',
    title: 'Molecule (3 atoms)',
    description: 'Three-atom molecular simulation.',
    category: 'Springs',
    url: 'https://www.myphysicslab.com/spring/molecule3-en.html',
    topics: ['molecule', 'spring', 'potential energy'],
  },
  {
    key: 'molecule4',
    title: 'Molecule (4 atoms)',
    description: 'Four-atom molecular simulation with spring forces.',
    category: 'Springs',
    url: 'https://www.myphysicslab.com/spring/molecule4-en.html',
    topics: ['molecule', 'spring', 'potential energy'],
  },
  {
    key: 'molecule5',
    title: 'Molecule (5 atoms)',
    description: 'Five-atom molecular simulation.',
    category: 'Springs',
    url: 'https://www.myphysicslab.com/spring/molecule5-en.html',
    topics: ['molecule', 'spring'],
  },
  {
    key: 'molecule6',
    title: 'Molecule (6 atoms)',
    description: 'Six-atom molecular cluster simulation.',
    category: 'Springs',
    url: 'https://www.myphysicslab.com/spring/molecule6-en.html',
    topics: ['molecule', 'spring'],
  },

  // ── Collisions ─────────────────────────────────────────────────────────────
  {
    key: 'colliding-blocks',
    title: 'Colliding Blocks',
    description: 'Elastic and inelastic collisions between sliding blocks.',
    category: 'Collisions',
    url: 'https://www.myphysicslab.com/engine2D/collide-blocks-en.html',
    topics: ['collision', 'momentum', 'kinetic energy', 'elastic', 'inelastic'],
  },
  {
    key: 'newtons-cradle',
    title: "Newton's Cradle",
    description: "Simulate the classic Newton's cradle demonstrating momentum transfer.",
    category: 'Collisions',
    url: 'https://www.myphysicslab.com/engine2D/newtons-cradle-en.html',
    topics: ['collision', 'momentum', 'elastic collision', "Newton's cradle"],
  },
  {
    key: 'rigid-body-collisions',
    title: 'Rigid Body Collisions',
    description: 'Multiple rigid bodies colliding with realistic physics.',
    category: 'Collisions',
    url: 'https://www.myphysicslab.com/engine2D/rigid-body-en.html',
    topics: ['rigid body', 'collision', 'torque', 'angular momentum'],
  },
  {
    key: 'billiards',
    title: 'Billiards',
    description: 'Billiard ball collisions on a table with friction.',
    category: 'Collisions',
    url: 'https://www.myphysicslab.com/engine2D/billiards-en.html',
    topics: ['collision', 'friction', 'billiards', 'momentum'],
  },
  {
    key: 'contact-forces',
    title: 'Contact Forces',
    description: 'Objects resting and sliding under normal and friction forces.',
    category: 'Collisions',
    url: 'https://www.myphysicslab.com/engine2D/contact-en.html',
    topics: ['contact', 'friction', 'normal force', 'statics'],
  },
  {
    key: 'pile-of-blocks',
    title: 'Pile of Blocks',
    description: 'Stack of rigid blocks showing contact forces and stability.',
    category: 'Collisions',
    url: 'https://www.myphysicslab.com/engine2D/pile-en.html',
    topics: ['rigid body', 'statics', 'contact', 'stability'],
  },
  {
    key: 'pegs',
    title: 'Pegs',
    description: 'Ball bouncing through a maze of pegs.',
    category: 'Collisions',
    url: 'https://www.myphysicslab.com/engine2D/pegs-en.html',
    topics: ['collision', 'bounce', 'gravity'],
  },
  {
    key: 'marbles',
    title: 'Marbles',
    description: 'Multiple marbles colliding in 2D.',
    category: 'Collisions',
    url: 'https://www.myphysicslab.com/engine2D/marbles-en.html',
    topics: ['collision', 'momentum', 'elastic'],
  },
  {
    key: 'polygon-shapes',
    title: 'Polygon Shapes',
    description: 'Polygonal rigid bodies interacting with collisions and contact.',
    category: 'Collisions',
    url: 'https://www.myphysicslab.com/engine2D/polygon-en.html',
    topics: ['polygon', 'rigid body', 'collision', 'contact'],
  },
  {
    key: 'sumo',
    title: 'Sumo',
    description: 'Two bodies pushing each other off a circular platform.',
    category: 'Collisions',
    url: 'https://www.myphysicslab.com/engine2D/sumo-en.html',
    topics: ['rigid body', 'collision', 'force', 'friction'],
  },

  // ── Roller Coasters ────────────────────────────────────────────────────────
  {
    key: 'roller-coaster',
    title: 'Roller Coaster',
    description: 'Ball rolling along a curved roller-coaster track.',
    category: 'Roller Coasters',
    url: 'https://www.myphysicslab.com/roller/roller-single-en.html',
    topics: ['roller coaster', 'energy conservation', 'potential energy', 'kinetic energy'],
  },
  {
    key: 'roller-spring',
    title: 'Roller Coaster with Spring',
    description: 'Roller-coaster ball launched by a spring.',
    category: 'Roller Coasters',
    url: 'https://www.myphysicslab.com/roller/roller-spring-en.html',
    topics: ['roller coaster', 'spring', 'energy', 'launch'],
  },
  {
    key: 'roller-double',
    title: 'Double Roller Coaster',
    description: 'Two balls on the same track for comparison.',
    category: 'Roller Coasters',
    url: 'https://www.myphysicslab.com/roller/roller-double-en.html',
    topics: ['roller coaster', 'comparison', 'energy'],
  },
  {
    key: 'roller-flight',
    title: 'Roller Coaster Flight',
    description: 'Ball leaves the track and flies through the air.',
    category: 'Roller Coasters',
    url: 'https://www.myphysicslab.com/roller/roller-flight-en.html',
    topics: ['roller coaster', 'projectile', 'flight', 'energy'],
  },
  {
    key: 'roller-rigid',
    title: 'Rigid Body Roller Coaster',
    description: 'A rigid body rolls along a curved track.',
    category: 'Roller Coasters',
    url: 'https://www.myphysicslab.com/engine2D/roller-en.html',
    topics: ['roller coaster', 'rigid body', 'rolling', 'rotation'],
  },
  {
    key: 'hanging-chain',
    title: 'Hanging Chain',
    description: 'A chain hanging under gravity forming a catenary curve.',
    category: 'Roller Coasters',
    url: 'https://www.myphysicslab.com/roller/hanging-chain-en.html',
    topics: ['catenary', 'hanging chain', 'statics', 'gravity'],
  },
  {
    key: 'brachistochrone',
    title: 'Brachistochrone',
    description: 'The curve of fastest descent — comparing different slide paths.',
    category: 'Roller Coasters',
    url: 'https://www.myphysicslab.com/roller/brachistochrone-en.html',
    topics: ['brachistochrone', 'calculus of variations', 'energy', 'fastest path'],
  },
  {
    key: 'car-suspension',
    title: 'Car Suspension',
    description: 'Spring-damper car suspension absorbing road bumps.',
    category: 'Roller Coasters',
    url: 'https://www.myphysicslab.com/roller/car-suspension-en.html',
    topics: ['suspension', 'spring', 'damper', 'vibration'],
  },

  // ── Orbital ────────────────────────────────────────────────────────────────
  {
    key: 'gravity-force',
    title: 'Gravity Force',
    description: 'Point masses attracting each other under gravitational force.',
    category: 'Orbital',
    url: 'https://www.myphysicslab.com/engine2D/gravity-en.html',
    topics: ['gravity', 'force', 'attraction', 'orbit'],
  },
  {
    key: 'gravity-2',
    title: 'Two-Body Gravity',
    description: 'Two-body gravitational system showing elliptical orbits.',
    category: 'Orbital',
    url: 'https://www.myphysicslab.com/engine2D/gravity2-en.html',
    topics: ['gravity', 'two-body', 'orbit', 'Kepler', 'ellipse'],
  },
  {
    key: 'mars-moon',
    title: 'Mars & Moon Orbits',
    description: 'Simulation of Mars and its moons Phobos and Deimos.',
    category: 'Orbital',
    url: 'https://www.myphysicslab.com/engine2D/mars-moon-en.html',
    topics: ['orbit', 'Mars', 'moon', 'Kepler', 'solar system'],
  },

  // ── Waves ──────────────────────────────────────────────────────────────────
  {
    key: 'wave-1d',
    title: '1D Wave',
    description: 'Transverse wave propagation along a string.',
    category: 'Waves',
    url: 'https://www.myphysicslab.com/wave/wave-en.html',
    topics: ['wave', 'transverse', 'propagation', 'string'],
  },
  {
    key: 'circular-waves',
    title: 'Circular Waves',
    description: 'Circular wave fronts expanding from a point source.',
    category: 'Waves',
    url: 'https://www.myphysicslab.com/wave/circular-wave-en.html',
    topics: ['wave', 'circular', 'interference', 'diffraction'],
  },

  // ── Other ──────────────────────────────────────────────────────────────────
  {
    key: 'direction-field',
    title: 'Direction Field',
    description: 'Visualises the slope field of a differential equation.',
    category: 'Other',
    url: 'https://www.myphysicslab.com/pendulum/direction-field-en.html',
    topics: ['differential equations', 'slope field', 'phase plane'],
  },
  {
    key: 'phase-portrait',
    title: 'Phase Portrait',
    description: 'Phase-space trajectories for a pendulum system.',
    category: 'Other',
    url: 'https://www.myphysicslab.com/pendulum/double-pendulum-en.html',
    topics: ['phase portrait', 'phase space', 'dynamical systems'],
  },
  {
    key: 'dangling-stick',
    title: 'Dangling Stick',
    description: 'Rigid stick attached at one end, free to swing.',
    category: 'Other',
    url: 'https://www.myphysicslab.com/engine2D/dangling-stick-en.html',
    topics: ['rigid body', 'rotation', 'constraint', 'pendulum'],
  },
  {
    key: 'square-bumper',
    title: 'Square Bumper',
    description: 'Ball bouncing inside a square bumper.',
    category: 'Other',
    url: 'https://www.myphysicslab.com/engine2D/square-bumper-en.html',
    topics: ['collision', 'bounce', 'rigid body', 'billiards'],
  },
  {
    key: 'spinner',
    title: 'Spinner',
    description: 'Rigid body spinning freely under no forces.',
    category: 'Other',
    url: 'https://www.myphysicslab.com/engine2D/spinner-en.html',
    topics: ['rotation', 'angular momentum', 'rigid body'],
  },
  {
    key: 'inclined-plane',
    title: 'Inclined Plane',
    description: 'Block sliding down an inclined plane with optional friction.',
    category: 'Other',
    url: 'https://www.myphysicslab.com/engine2D/inclined-plane-en.html',
    topics: ['inclined plane', 'friction', 'gravity', 'Newton\'s second law'],
  },
  {
    key: 'wall',
    title: 'Wall Bounce',
    description: 'Balls bouncing off walls in an enclosed container.',
    category: 'Other',
    url: 'https://www.myphysicslab.com/engine2D/wall-en.html',
    topics: ['collision', 'momentum', 'bounce', 'ideal gas'],
  },
]
