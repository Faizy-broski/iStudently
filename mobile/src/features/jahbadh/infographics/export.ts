// Output of the infographic pages on the device: each page is captured from an unscaled offscreen copy
// (react-native-view-shot), then shared as a PNG (2× = 2246 px wide) or put, page by page, into one A4-landscape PDF.
import type { RefObject } from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { sharePdf } from '@/lib/print';
import { shareBase64File } from '@/lib/share-file';

import { PAGE_H, PAGE_W } from './palette';

const safeName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'report';

/** Waits for layout and the SVG drawing of a freshly mounted page. */
export const settle = () => new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 180)));

/** The mounted page as base64 (no data: prefix). */
export function captureBase64(view: RefObject<View | null>, format: 'png' | 'jpg', scale: number, quality = 1) {
  return captureRef(view, { format, quality, result: 'base64', width: Math.round(PAGE_W * scale), height: Math.round(PAGE_H * scale) });
}

export const shareImage = (name: string, base64: string) => shareBase64File(`${safeName(name)}.png`, base64, 'image/png');

/** One PDF: every page is a full-bleed A4 landscape image. */
export function sharePagesPdf(name: string, jpegs: string[]) {
  const imgs = jpegs.map((b) => `<div class="p"><img src="data:image/jpeg;base64,${b}"/></div>`).join('');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>@page{size:297mm 210mm;margin:0}html,body{margin:0;padding:0}.p{width:297mm;height:210mm;page-break-after:always;break-after:page}.p:last-child{page-break-after:auto}.p img{width:297mm;height:210mm;display:block}</style></head><body>${imgs}</body></html>`;
  return sharePdf(html, `${safeName(name)}.pdf`, { width: 842, height: 595 });
}
