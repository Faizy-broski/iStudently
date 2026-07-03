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
    url: 'https://www.myphysicslab.com/springs/single-spring-en.html',
    topics: ['spring', 'Hooke\'s law', 'simple harmonic motion', 'oscillation'],
  },
  {
    key: 'double-spring',
    title: 'Double Spring',
    description: 'Two masses connected by springs, showing coupled oscillations.',
    category: 'Springs',
    url: 'https://www.myphysicslab.com/springs/double-spring-en.html',
    topics: ['spring', 'coupled oscillation', 'normal modes'],
  },
  {
    key: 'spring-2d',
    title: '2D Spring',
    description: 'A mass bouncing on a spring in two dimensions.',
    category: 'Springs',
    url: 'https://www.myphysicslab.com/springs/2d-spring-en.html',
    topics: ['spring', '2D motion', 'oscillation'],
  },
  {
    key: 'double-spring-2d',
    title: 'Double 2D Spring',
    description: 'Two connected springs in 2D showing coupled 2D oscillations.',
    category: 'Springs',
    url: 'https://www.myphysicslab.com/springs/double-2d-spring-en.html',
    topics: ['spring', '2D', 'coupled oscillation'],
  },
  {
    key: 'molecule2',
    title: 'Molecule (2 atoms)',
    description: 'Two-atom molecular simulation with spring-like intermolecular forces.',
    category: 'Springs',
    url: 'https://www.myphysicslab.com/springs/molecule2-en.html',
    topics: ['molecule', 'spring', 'potential energy', 'intermolecular forces'],
  },
  {
    key: 'molecule3',
    title: 'Molecule (3 atoms)',
    description: 'Three-atom molecular simulation.',
    category: 'Springs',
    url: 'https://www.myphysicslab.com/springs/molecule3-en.html',
    topics: ['molecule', 'spring', 'potential energy'],
  },
  {
    key: 'molecule4',
    title: 'Molecule (4 atoms)',
    description: 'Four-atom molecular simulation with spring forces.',
    category: 'Springs',
    url: 'https://www.myphysicslab.com/springs/molecule4-en.html',
    topics: ['molecule', 'spring', 'potential energy'],
  },
  {
    key: 'molecule5',
    title: 'Molecule (5 atoms)',
    description: 'Five-atom molecular simulation.',
    category: 'Springs',
    url: 'https://www.myphysicslab.com/springs/molecule5-en.html',
    topics: ['molecule', 'spring'],
  },
  {
    key: 'molecule6',
    title: 'Molecule (6 atoms)',
    description: 'Six-atom molecular cluster simulation.',
    category: 'Springs',
    url: 'https://www.myphysicslab.com/springs/molecule6-en.html',
    topics: ['molecule', 'spring'],
  },

  // ── Collisions ─────────────────────────────────────────────────────────────
  {
    key: 'colliding-blocks',
    title: 'Colliding Blocks',
    description: 'Elastic and inelastic collisions between sliding blocks.',
    category: 'Collisions',
    url: 'https://www.myphysicslab.com/springs/collide-blocks-en.html',
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
    key: 'polygon-shapes',
    title: 'Polygon Shapes',
    description: 'Polygonal rigid bodies interacting with collisions and contact.',
    category: 'Collisions',
    url: 'https://www.myphysicslab.com/engine2D/shapes-en.html',
    topics: ['polygon', 'rigid body', 'collision', 'contact'],
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
    url: 'https://www.myphysicslab.com/roller/rigid-body-roller-en.html',
    topics: ['roller coaster', 'rigid body', 'rolling', 'rotation'],
  },
  {
    key: 'hanging-chain',
    title: 'Hanging Chain',
    description: 'A chain hanging under gravity forming a catenary curve.',
    category: 'Roller Coasters',
    url: 'https://www.myphysicslab.com/engine2D/chain-en.html',
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
    url: 'https://www.myphysicslab.com/engine2D/car-suspension-en.html',
    topics: ['suspension', 'spring', 'damper', 'vibration'],
  },

  // ── Orbital ────────────────────────────────────────────────────────────────
  {
    key: 'gravity-force',
    title: 'Gravity Force',
    description: 'Point masses attracting each other under gravitational force.',
    category: 'Orbital',
    url: 'https://www.myphysicslab.com/engine2D/mutual-attract-en.html',
    topics: ['gravity', 'force', 'attraction', 'orbit'],
  },
  {
    key: 'gravity-2',
    title: 'Two-Body Gravity',
    description: 'Two-body gravitational system showing elliptical orbits.',
    category: 'Orbital',
    url: 'https://www.myphysicslab.com/engine2D/mutual-attract-en.html',
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
    url: 'https://www.myphysicslab.com/pde/string-en.html',
    topics: ['wave', 'transverse', 'propagation', 'string'],
  },
  {
    key: 'circular-waves',
    title: 'Circular Waves',
    description: 'Circular wave fronts expanding from a point source.',
    category: 'Waves',
    url: 'https://www.myphysicslab.com/pde/string-en.html',
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
    url: 'https://www.myphysicslab.com/springs/dangle-stick-en.html',
    topics: ['rigid body', 'rotation', 'constraint', 'pendulum'],
  },
]

// ── Arabic translations ─────────────────────────────────────────────────────

export const CATEGORY_LABELS_AR: Record<SimCategory, string> = {
  Pendulums: 'البندولات',
  Springs: 'الزنبركات',
  Collisions: 'التصادمات',
  'Roller Coasters': 'قطارات الجبل الروسي',
  Orbital: 'المدارية',
  Waves: 'الأمواج',
  Other: 'أخرى',
}

export const PHYSICS_CATALOG_AR: Record<string, { title: string; description: string; topics: string[] }> = {
  // Pendulums
  'single-pendulum': {
    title: 'البندول المفرد',
    description: 'بندول كلاسيكي يوضح الحركة التوافقية البسيطة والجاذبية والدورة.',
    topics: ['بندول', 'اهتزاز', 'جاذبية', 'حركة توافقية بسيطة'],
  },
  'double-pendulum': {
    title: 'البندول المزدوج',
    description: 'بندولان متصلان يُظهران حركة فوضوية.',
    topics: ['بندول', 'فوضى', 'اهتزاز', 'ديناميكا لاخطية'],
  },
  'chaotic-pendulum': {
    title: 'البندول الفوضوي',
    description: 'بندول مُحرَّك يوضح الحساسية للشروط الابتدائية.',
    topics: ['بندول', 'فوضى', 'اهتزاز مُحرَّك', 'رنين'],
  },
  'inverted-pendulum': {
    title: 'البندول المعكوس',
    description: 'موازنة بندول غير مستقر في الوضع الرأسي.',
    topics: ['بندول', 'استقرار', 'تحكم', 'توازن'],
  },
  'moveable-pendulum': {
    title: 'البندول المتحرك',
    description: 'بندول مثبت على عربة تتحرك بحرية.',
    topics: ['بندول', 'عربة', 'حركة مزدوجة'],
  },
  'pendulum-clock': {
    title: 'ساعة البندول',
    description: 'ساعة ميكانيكية تعمل بنظام الهروب والبندول المتأرجح.',
    topics: ['بندول', 'ساعة', 'آلية هروب', 'آلية'],
  },
  'compare-pendulum': {
    title: 'مقارنة البندولات',
    description: 'مقارنة جنبًا إلى جنب للبندولات ذات الأطوال والشروط المختلفة.',
    topics: ['بندول', 'مقارنة', 'دورة', 'طول'],
  },
  'cart-pendulum': {
    title: 'العربة والبندول',
    description: 'بندول مثبت على عربة تتدحرج على مسار عديم الاحتكاك.',
    topics: ['بندول', 'عربة', 'حركة مزدوجة', 'حفظ الزخم'],
  },
  // Springs
  'single-spring': {
    title: 'الزنبرك المفرد',
    description: 'كتلة على زنبرك توضح قانون هوك والحركة التوافقية البسيطة.',
    topics: ['زنبرك', 'قانون هوك', 'حركة توافقية بسيطة', 'اهتزاز'],
  },
  'double-spring': {
    title: 'الزنبرك المزدوج',
    description: 'كتلتان متصلتان بزنبركات تُظهران اهتزازات مزدوجة.',
    topics: ['زنبرك', 'اهتزاز مزدوج', 'أوضاع طبيعية'],
  },
  'spring-2d': {
    title: 'الزنبرك ثنائي الأبعاد',
    description: 'كتلة تتدحرج على زنبرك في بُعدين.',
    topics: ['زنبرك', 'حركة ثنائية الأبعاد', 'اهتزاز'],
  },
  'double-spring-2d': {
    title: 'الزنبرك المزدوج ثنائي الأبعاد',
    description: 'زنبركان متصلان في فضاء ثنائي الأبعاد يُظهران اهتزازات مزدوجة.',
    topics: ['زنبرك', 'ثنائي الأبعاد', 'اهتزاز مزدوج'],
  },
  molecule2: {
    title: 'الجزيء (ذرتان)',
    description: 'محاكاة جزيء ثنائي الذرة بقوى بين جزيئية شبيهة بالزنبرك.',
    topics: ['جزيء', 'زنبرك', 'طاقة كامنة', 'قوى بين جزيئية'],
  },
  molecule3: {
    title: 'الجزيء (3 ذرات)',
    description: 'محاكاة جزيء ثلاثي الذرات.',
    topics: ['جزيء', 'زنبرك', 'طاقة كامنة'],
  },
  molecule4: {
    title: 'الجزيء (4 ذرات)',
    description: 'محاكاة جزيء رباعي الذرات بقوى زنبركية.',
    topics: ['جزيء', 'زنبرك', 'طاقة كامنة'],
  },
  molecule5: {
    title: 'الجزيء (5 ذرات)',
    description: 'محاكاة جزيء خماسي الذرات.',
    topics: ['جزيء', 'زنبرك'],
  },
  molecule6: {
    title: 'الجزيء (6 ذرات)',
    description: 'محاكاة عنقود جزيئي سداسي الذرات.',
    topics: ['جزيء', 'زنبرك'],
  },
  // Collisions
  'colliding-blocks': {
    title: 'المكعبات المتصادمة',
    description: 'تصادمات مرنة وغير مرنة بين مكعبات منزلقة.',
    topics: ['تصادم', 'زخم', 'طاقة حركية', 'مرن', 'غير مرن'],
  },
  'newtons-cradle': {
    title: 'مهد نيوتن',
    description: 'محاكاة مهد نيوتن الكلاسيكي الذي يوضح انتقال الزخم.',
    topics: ['تصادم', 'زخم', 'تصادم مرن', 'مهد نيوتن'],
  },
  'rigid-body-collisions': {
    title: 'تصادمات الأجسام الصلبة',
    description: 'أجسام صلبة متعددة تتصادم بفيزياء واقعية.',
    topics: ['جسم صلب', 'تصادم', 'عزم دوران', 'زخم زاوي'],
  },
  billiards: {
    title: 'البلياردو',
    description: 'تصادمات كرات البلياردو على طاولة مع الاحتكاك.',
    topics: ['تصادم', 'احتكاك', 'بلياردو', 'زخم'],
  },
  'contact-forces': {
    title: 'قوى التلامس',
    description: 'أجسام في حالة سكون وانزلاق تحت تأثير قوى التلامس والاحتكاك.',
    topics: ['تلامس', 'احتكاك', 'قوة عمودية', 'سكونيات'],
  },
  'pile-of-blocks': {
    title: 'كومة المكعبات',
    description: 'مجموعة من المكعبات الصلبة تُظهر قوى التلامس والاستقرار.',
    topics: ['جسم صلب', 'سكونيات', 'تلامس', 'استقرار'],
  },
  'polygon-shapes': {
    title: 'الأشكال المضلعة',
    description: 'أجسام صلبة مضلعة تتفاعل بالتصادم والتلامس.',
    topics: ['مضلع', 'جسم صلب', 'تصادم', 'تلامس'],
  },
  // Roller Coasters
  'roller-coaster': {
    title: 'قطار الجبل الروسي',
    description: 'كرة تتدحرج على مسار منحنٍ لقطار الجبل الروسي.',
    topics: ['قطار الجبل الروسي', 'حفظ الطاقة', 'طاقة كامنة', 'طاقة حركية'],
  },
  'roller-spring': {
    title: 'قطار الجبل مع الزنبرك',
    description: 'كرة قطار الجبل تنطلق بواسطة زنبرك.',
    topics: ['قطار الجبل الروسي', 'زنبرك', 'طاقة', 'انطلاق'],
  },
  'roller-double': {
    title: 'قطار الجبل المزدوج',
    description: 'كرتان على نفس المسار للمقارنة.',
    topics: ['قطار الجبل الروسي', 'مقارنة', 'طاقة'],
  },
  'roller-flight': {
    title: 'طيران قطار الجبل',
    description: 'كرة تغادر المسار وتطير في الهواء.',
    topics: ['قطار الجبل الروسي', 'قذيفة', 'طيران', 'طاقة'],
  },
  'roller-rigid': {
    title: 'قطار الجبل ذو الجسم الصلب',
    description: 'جسم صلب يتدحرج على مسار منحنٍ.',
    topics: ['قطار الجبل الروسي', 'جسم صلب', 'دحرجة', 'دوران'],
  },
  'hanging-chain': {
    title: 'السلسلة المعلقة',
    description: 'سلسلة معلقة تحت تأثير الجاذبية تكوّن منحنى تعليق.',
    topics: ['منحنى تعليق', 'سلسلة معلقة', 'سكونيات', 'جاذبية'],
  },
  brachistochrone: {
    title: 'منحنى أسرع انحدار',
    description: 'منحنى النزول الأسرع — مقارنة مسارات الانزلاق المختلفة.',
    topics: ['أسرع انحدار', 'حساب التغيرات', 'طاقة', 'أسرع مسار'],
  },
  'car-suspension': {
    title: 'تعليق السيارة',
    description: 'تعليق السيارة ذو الزنبرك والمخمّد الذي يمتص الاهتزازات.',
    topics: ['تعليق', 'زنبرك', 'مخمّد', 'اهتزاز'],
  },
  // Orbital
  'gravity-force': {
    title: 'قوة الجاذبية',
    description: 'كتل نقطية تتجاذب تحت تأثير قوة الجاذبية.',
    topics: ['جاذبية', 'قوة', 'جذب', 'مدار'],
  },
  'gravity-2': {
    title: 'جاذبية الجسمين',
    description: 'نظام جاذبية ثنائي الجسم يُظهر مدارات إهليجية.',
    topics: ['جاذبية', 'ثنائي الجسم', 'مدار', 'كبلر', 'إهليج'],
  },
  'mars-moon': {
    title: 'مدارات المريخ وقمره',
    description: 'محاكاة لمدارات المريخ وقمريه فوبوس وديموس.',
    topics: ['مدار', 'المريخ', 'قمر', 'كبلر', 'النظام الشمسي'],
  },
  // Waves
  'wave-1d': {
    title: 'موجة أحادية البُعد',
    description: 'انتشار موجة عرضية على طول وتر.',
    topics: ['موجة', 'عرضي', 'انتشار', 'وتر'],
  },
  'circular-waves': {
    title: 'أمواج دائرية',
    description: 'جبهات موجة دائرية تمتد من مصدر نقطي.',
    topics: ['موجة', 'دائري', 'تداخل', 'حيود'],
  },
  // Other
  'direction-field': {
    title: 'حقل الاتجاهات',
    description: 'تصوير حقل الميل لمعادلة تفاضلية.',
    topics: ['معادلات تفاضلية', 'حقل ميل', 'مستوى الطور'],
  },
  'phase-portrait': {
    title: 'صورة الطور',
    description: 'مسارات فضاء الطور لنظام بندول.',
    topics: ['صورة الطور', 'فضاء الطور', 'أنظمة ديناميكية'],
  },
  'dangling-stick': {
    title: 'العصا المتدلية',
    description: 'عصا صلبة مثبتة من أحد طرفيها، حرة الدوران.',
    topics: ['جسم صلب', 'دوران', 'قيد', 'بندول'],
  },
}

export function getSimLocalized(
  sim: SimulationMeta,
  locale: string,
): { title: string; description: string; topics: string[]; category: string } {
  if (locale === 'ar') {
    const ar = PHYSICS_CATALOG_AR[sim.key]
    if (ar) {
      return { ...ar, category: CATEGORY_LABELS_AR[sim.category] }
    }
  }
  return {
    title: sim.title,
    description: sim.description,
    topics: sim.topics,
    category: sim.category,
  }
}
