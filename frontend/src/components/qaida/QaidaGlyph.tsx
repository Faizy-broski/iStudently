'use client';

import { memo } from 'react';

const TASHKEEL = /[\u064B-\u0652\u0670]/;

/**
 * يعرض نصاً عربياً بخط النسخ، ويلوّن الحرف محلّ الدرس بالقرمزي —
 * قاعدة الحبر التي تتبعها القواعد المطبوعة: الأحمر يعلّم ولا يزيّن.
 */
export const QaidaGlyph = memo(function QaidaGlyph({
  text, mark, size = 'lg', className = '',
}: {
  text: string;
  mark?: string | null;
  size?: 'sm' | 'lg';
  className?: string;
}) {
  const base = size === 'lg'
    ? 'text-[clamp(3.5rem,16vw,7rem)] leading-[1.6]'
    : 'text-[clamp(1.6rem,6vw,2.6rem)] leading-[2]';

  if (!mark) {
    return <div className={`font-scribe font-bold ${base} ${className}`}>{text}</div>;
  }

  const chars = Array.from(text);
  const parts: { t: string; hit: boolean }[] = [];
  let done = false;
  for (let i = 0; i < chars.length; i++) {
    if (!done && chars[i] === mark) {
      let seg = chars[i];
      let j = i + 1;
      while (j < chars.length && TASHKEEL.test(chars[j])) { seg += chars[j]; j++; }
      parts.push({ t: seg, hit: true });
      i = j - 1;
      done = true;
    } else {
      parts.push({ t: chars[i], hit: false });
    }
  }

  return (
    <div className={`font-scribe font-bold ${base} ${className}`}>
      {parts.map((p, i) =>
        p.hit
          ? <span key={i} className="text-[var(--qaida-ink-red)]">{p.t}</span>
          : <span key={i}>{p.t}</span>,
      )}
    </div>
  );
});
