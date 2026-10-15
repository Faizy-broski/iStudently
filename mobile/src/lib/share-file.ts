import { File, Paths } from 'expo-file-system';
import { Platform, Share } from 'react-native';

/**
 * Writes text to a temporary file and opens the share sheet (save to Files, email, Drive...).
 * Falls back to sharing the text itself if the sharing module isn't in this build.
 */
export async function shareTextFile(name: string, text: string, mimeType: string, uti?: string) {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(text);
  try {
    const Sharing = await import('expo-sharing');
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, { mimeType, UTI: uti, dialogTitle: name });
      return;
    }
  } catch {
    // Older dev build without expo-sharing: use React Native's share below.
  }
  await Share.share(Platform.OS === 'ios' ? { url: file.uri } : { message: text, title: name });
}

/**
 * Downloads an authenticated API file (Excel, PDF...) and opens the share sheet.
 * `path` is relative to the API base URL, like the api-client endpoints.
 */
export async function shareApiFile(path: string, name: string, mimeType: string, init?: { method?: 'GET' | 'POST'; body?: unknown }) {
  const [{ env }, { supabase }] = await Promise.all([import('./env'), import('./supabase')]);
  const { data } = await supabase.auth.getSession();
  const res = await fetch(`${env.apiUrl}${path}`, {
    method: init?.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${data.session?.access_token ?? ''}`,
      ...(init?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error || `Download failed (${res.status})`);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(bytes);
  const Sharing = await import('expo-sharing');
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: name });
}

/** Downloads a public file (e.g. a library book in Storage) and opens the share sheet. No auth header is sent. */
export async function sharePublicFile(url: string, name: string, mimeType: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(bytes);
  const Sharing = await import('expo-sharing');
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: name });
}

/** Writes base64 bytes to a temporary file and opens the share sheet. */
export async function shareBase64File(name: string, base64: string, mimeType: string) {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(base64, { encoding: 'base64' });
  const Sharing = await import('expo-sharing');
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: name });
}
