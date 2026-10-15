// Development-only screenshots of whole pages (the full scrollable height, not just what fits on
// screen), for design and documentation. Run from the developer menu (⌘D in the iOS Simulator).
// Files are saved in the app's Documents/screenshots folder; `npm run screenshots` copies them to
// ~/Desktop/studently-screens. Never runs in release builds.
import { Directory, File, Paths } from 'expo-file-system';
import { Alert, Dimensions } from 'react-native';
import { captureRef, captureScreen } from 'react-native-view-shot';

type Fiber = { type: unknown; stateNode: any; child: Fiber | null; sibling: Fiber | null; memoizedProps?: { horizontal?: boolean } };

let root: { __internalInstanceHandle?: Fiber } | null = null;
let route = 'screen';

/** The app's outermost view (its subtree holds every screen). */
export function setCaptureRoot(view: unknown) {
  root = view as typeof root;
}

/** The current route, for file names. */
export function setCaptureRoute(path: string) {
  route = path === '/' ? 'home' : path.replace(/^\//, '').replace(/[^a-zA-Z0-9-]+/g, '_');
}

/** Every vertical native scroll view under the root, in tree order (later = nearer the top of the stack). */
function scrollViews(): any[] {
  const start = root?.__internalInstanceHandle;
  if (!start) return [];
  const found: any[] = [];
  const stack: Fiber[] = [start];
  while (stack.length) {
    const f = stack.pop()!;
    if (f.type === 'RCTScrollView' && !f.memoizedProps?.horizontal) {
      const instance = f.stateNode?.canonical?.publicInstance ?? f.stateNode;
      if (instance) found.push(instance);
    }
    // Push sibling first so the child is visited first (document order).
    if (f.sibling) stack.push(f.sibling);
    if (f.child) stack.push(f.child);
  }
  return found;
}

function measure(view: any): Promise<{ x: number; y: number; w: number; h: number } | null> {
  return new Promise((resolve) => {
    try {
      view.measureInWindow((x: number, y: number, w: number, h: number) => resolve({ x, y, w, h }));
    } catch {
      resolve(null);
    }
  });
}

/** The scroll view the user is looking at: on screen, tall enough, the last such one in the tree. */
async function visibleScrollView() {
  const { width, height } = Dimensions.get('window');
  let pick: any = null;
  for (const v of scrollViews()) {
    const m = await measure(v);
    if (!m || m.w < width * 0.6 || m.h < 120) continue;
    if (m.x < -1 || m.x > width * 0.4 || m.y > height * 0.8) continue;
    pick = v;
  }
  return pick;
}

function save(tmpUri: string, kind: string) {
  const dir = new Directory(Paths.document, 'screenshots');
  if (!dir.exists) dir.create({ intermediates: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const name = `${route}-${kind}-${stamp}.png`;
  new File(tmpUri).copy(new File(dir, name));
  return name;
}

export async function captureFullPage() {
  try {
    const view = await visibleScrollView();
    if (!view) {
      Alert.alert('Full-page capture', 'No scrollable page found on this screen. Use "Capture visible screen" instead.');
      return;
    }
    const uri = await captureRef(view, { format: 'png', result: 'tmpfile', snapshotContentContainer: true });
    Alert.alert('Saved full page', `${save(uri, 'full')}\n\nRun "npm run screenshots" in mobile/ to copy them to your Desktop.`);
  } catch (e) {
    Alert.alert('Capture failed', e instanceof Error ? e.message : String(e));
  }
}

export async function captureVisible() {
  try {
    const uri = await captureScreen({ format: 'png', result: 'tmpfile' });
    Alert.alert('Saved screen', save(uri, 'screen'));
  } catch (e) {
    Alert.alert('Capture failed', e instanceof Error ? e.message : String(e));
  }
}

let registered = false;
/** Adds the two capture actions to the Expo developer menu (dev builds only). */
export function registerCaptureMenu() {
  if (!__DEV__ || registered) return;
  registered = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { registerDevMenuItems } = require('expo-dev-menu') as typeof import('expo-dev-menu');
    void registerDevMenuItems([
      { name: 'Capture full page (screenshot)', callback: () => void captureFullPage(), shouldCollapse: true },
      { name: 'Capture visible screen (screenshot)', callback: () => void captureVisible(), shouldCollapse: true },
    ]);
  } catch {
    // Not a development client build.
  }
}
