import { Copy, ArrowUp, ArrowDown, ArrowUpFromLine } from 'lucide-react';

const WASHI_COLORS = ['#FFD9EC', '#D9EEFF', '#FFF0C7', '#E1D6FF', '#D3F6E7'];

type StickerVariant = 'star' | 'heart' | 'sparkle' | 'rainbow' | 'cloud';
const STICKER_CYCLE: StickerVariant[] = ['star', 'heart', 'sparkle', 'rainbow', 'cloud'];
const STICKER_STYLE: Record<StickerVariant, { bg: string; fg: string }> = {
  star: { bg: 'linear-gradient(145deg,#FFDA82,#FFB020)', fg: '#5B3B00' },
  heart: { bg: 'linear-gradient(145deg,#FFA9CB,#FF6FA5)', fg: '#5C0F30' },
  sparkle: { bg: 'linear-gradient(145deg,#D9B3FF,#B85FCC)', fg: '#3B0A4D' },
  cloud: { bg: 'linear-gradient(145deg,#CFEBFF,#7FCBEE)', fg: '#0E3A4A' },
  rainbow: { bg: 'linear-gradient(145deg,#FFFFFF,#F1E6FF)', fg: '#402C55' },
};

function Sticker({ variant, rotate, className }: { variant: StickerVariant; rotate: number; className?: string }) {
  const style = STICKER_STYLE[variant];
  const iconSize = 17;
  return (
    <div
      className={`pony-sticker pony-pop-in ${className ?? ''}`}
      style={{ width: 34, height: 34, background: style.bg, color: style.fg, transform: `rotate(${rotate}deg)` }}
    >
      {variant === 'star' && (
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill={style.fg} stroke={style.fg} strokeWidth={2.25}>
          <path d="M12 2l2.9 6.6L22 9.3l-5 4.9 1.2 7.1L12 17.8l-6.2 3.5L7 14.2 2 9.3l7.1-.7z" />
        </svg>
      )}
      {variant === 'heart' && (
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill={style.fg} stroke={style.fg} strokeWidth={2.25}>
          <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />
        </svg>
      )}
      {variant === 'sparkle' && (
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke={style.fg} strokeWidth={2.25}>
          <path d="M12 3l1.5 5L19 9.5l-5 1.5L12 16l-1.5-5L5 9.5l5-1.5z" />
        </svg>
      )}
      {variant === 'cloud' && (
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke={style.fg} strokeWidth={2.25}>
          <path d="M17.5 19H9a7 7 0 1 1 6.71-9h.79a4.5 4.5 0 1 1 0 9Z" />
        </svg>
      )}
      {variant === 'rainbow' && (
        <svg viewBox="0 0 64 40" style={{ width: '70%', height: '70%' }} fill="none">
          <path d="M4 38a28 28 0 0 1 56 0" stroke="#FF7FB4" strokeWidth={6} strokeLinecap="round" />
          <path d="M12 38a20 20 0 0 1 40 0" stroke="#FFC24B" strokeWidth={6} strokeLinecap="round" />
          <path d="M20 38a12 12 0 0 1 24 0" stroke="#4FB6E0" strokeWidth={6} strokeLinecap="round" />
        </svg>
      )}
    </div>
  );
}

type Props = {
  index: number;
  total: number;
  fragment: string;
  onCopy: () => void;
  onJump: (i: number) => void;
  onDownload: () => void;
};

export default function SegmentCard({ index, total, fragment, onCopy, onJump, onDownload }: Props) {
  const escaped = fragment;
  return (
    <div
      id={`seg-${index}`}
      className="relative bg-white border border-[rgba(228,214,247,0.7)] rounded-3xl shadow-lg hover:shadow-xl transition-shadow p-5 pt-6 flex flex-col scroll-mt-4"
    >
      <div className="washi-tape" style={{ background: WASHI_COLORS[index % WASHI_COLORS.length] }} />
      <Sticker variant={STICKER_CYCLE[index % STICKER_CYCLE.length]} rotate={index % 2 === 0 ? -12 : 12} className="-top-3 -right-3" />

      {/* Nav buttons */}
      <div className="flex gap-1 overflow-x-auto pb-3 w-full border-b border-[rgba(228,214,247,0.7)] mb-3 no-scrollbar">
        {Array.from({ length: total }, (_, j) => (
          <button
            key={j}
            onClick={() => onJump(j)}
            className={[
              'px-3 py-1 bg-white border rounded-lg text-xs font-bold flex-shrink-0 transition-colors',
              j === index
                ? 'border-[rgba(184,95,204,0.4)] text-[var(--primary)]'
                : 'border-[var(--border)] text-[var(--muted-foreground)] hover:border-[rgba(184,95,204,0.4)] hover:text-[var(--primary)]',
            ].join(' ')}
          >
            {j + 1}
          </button>
        ))}
      </div>

      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[rgba(124,104,146,0.7)]">
          Segment {index + 1}
        </span>
        <div className="flex gap-1 items-center">
          {index > 0 && (
            <button onClick={() => onJump(index - 1)} className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]">
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
          )}
          {index < total - 1 && (
            <button onClick={() => onJump(index + 1)} className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]">
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={onDownload} className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:bg-[rgba(184,95,204,0.1)] hover:text-[var(--primary)]" title="Download as .txt">
            <ArrowUpFromLine className="w-3.5 h-3.5" />
          </button>
          <button onClick={onCopy} className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:bg-[rgba(184,95,204,0.1)] hover:text-[var(--primary)]" title="Copy segment">
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <pre className="font-mono text-xs text-[rgba(64,44,85,0.8)] whitespace-pre-wrap break-words flex-grow m-0">
        {escaped}
      </pre>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-[rgba(228,214,247,0.5)] flex justify-between items-center">
        <span className="text-[9px] uppercase tracking-wider text-[rgba(124,104,146,0.6)]">End of Seg {index + 1}</span>
        <button
          onClick={() => onJump(index)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--muted-foreground)] rounded-lg hover:text-[var(--primary)] hover:bg-[rgba(184,95,204,0.1)] transition-colors"
        >
          <ArrowUp className="w-3.5 h-3.5" />
          Jump to Top
        </button>
      </div>
    </div>
  );
}
