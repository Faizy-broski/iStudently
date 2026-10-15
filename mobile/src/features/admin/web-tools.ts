import { env } from '@/lib/env';

/**
 * Interactive web tools shown in a WebView. Static ones (files in the website's /public) and
 * external labs load without sign-in; the React-based ones load the admin page signed in.
 */
export type WebTool = { title: string; kind: 'public'; url: string; origins?: string[] } | { title: string; kind: 'session'; path: string };

export const WEB_TOOLS: Record<string, WebTool> = {
  jperiod: { title: 'periodic_table', kind: 'public', url: `${env.webUrl}/jperiod/index.html` },
  // Second periodic table (web: /<role>/resources/zperiod, not in the web sidebar).
  zperiod: { title: 'periodic_table', kind: 'public', url: `${env.webUrl}/zperiod/index.html` },
  'arabic-fluency': { title: 'arabic_fluency', kind: 'public', url: `${env.webUrl}/arabic-fluency/home.html` },
  'calculators-arena': { title: 'calculators_arena', kind: 'public', url: `${env.webUrl}/tuxmath/index.html` },
  'human-atlas': { title: 'human_atlas', kind: 'public', url: `${env.webUrl}/human-atlas/index.html` },
  'physics-virtual-labs': { title: 'physics_virtual_labs', kind: 'public', url: 'https://physics-en.nobook.com/console/templates/resource' },
  'chemistry-virtual-labs': { title: 'chemistry_virtual_labs', kind: 'public', url: 'https://chemistry-en.nobook.com/console/templates/resource' },
  'circuit-simulator': { title: 'circuit_simulator', kind: 'session', path: '/admin/resources/circuit-simulator' },
  'interactive-geometry': { title: 'interactive_geometry', kind: 'session', path: '/admin/resources/interactive-geometry' },
  'mental-math': { title: 'mental_math', kind: 'session', path: '/admin/resources/mental-math' },
  'anatomy-3d': { title: 'anatomy_3d', kind: 'session', path: '/admin/resources/anatomy-3d' },
  qaida: { title: 'qaida_al_jahabidha', kind: 'session', path: '/admin/resources/qaida' },
  'virtual-labs': { title: 'virtual_labs', kind: 'session', path: '/admin/resources/virtual-labs' },
  // Template designers and card/certificate printing: drag-and-resize canvas editors, shown as the
  // website's own pages (user decision 2026-10-09).
  'id-card-designer': { title: 'id_card_designer', kind: 'session', path: '/admin/id-card' },
  'certificate-templates': { title: 'certificate_templates', kind: 'session', path: '/admin/certificate-templates' },
  'student-id-card': { title: 'student_id_card', kind: 'session', path: '/admin/students/id-card' },
  'certificate-enrollment': { title: 'certificate', kind: 'session', path: '/admin/students/certificate-enrollment' },
};

const RESOURCE_TOOLS = ['jperiod', 'zperiod', 'arabic-fluency', 'calculators-arena', 'human-atlas', 'physics-virtual-labs', 'chemistry-virtual-labs', 'circuit-simulator', 'interactive-geometry', 'mental-math', 'anatomy-3d', 'qaida', 'virtual-labs'];

/** The resource tools for a student/parent/teacher: same tools, signed-in ones load that role's web page. */
export function roleWebTools(role: 'student' | 'parent' | 'teacher'): Record<string, WebTool> {
  return Object.fromEntries(
    RESOURCE_TOOLS.map((key) => {
      const tool = WEB_TOOLS[key];
      return [key, tool.kind === 'session' ? { ...tool, path: tool.path.replace('/admin/', `/${role}/`) } : tool];
    }),
  );
}
