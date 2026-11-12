type Floater = {
  top: string;
  left: string;
  size: number;
  opacity: number;
  duration: number;
  delay: number;
  kind: 'cloud' | 'star' | 'sparkle' | 'rainbow';
  color: string;
  hideOnMobile?: boolean;
};

const FLOATERS: Floater[] = [
  { top: '6%', left: '8%', size: 46, opacity: 0.55, duration: 15, delay: 0, kind: 'cloud', color: '#8FC9EA' },
  { top: '14%', left: '78%', size: 60, opacity: 0.5, duration: 18, delay: 2, kind: 'cloud', color: '#8FC9EA', hideOnMobile: true },
  { top: '68%', left: '4%', size: 38, opacity: 0.45, duration: 14, delay: 1, kind: 'cloud', color: '#8FC9EA' },
  { top: '82%', left: '85%', size: 50, opacity: 0.5, duration: 17, delay: 3, kind: 'cloud', color: '#8FC9EA', hideOnMobile: true },
  { top: '24%', left: '18%', size: 18, opacity: 0.8, duration: 4, delay: 0.4, kind: 'star', color: '#FFC24B' },
  { top: '40%', left: '92%', size: 14, opacity: 0.7, duration: 5, delay: 1.2, kind: 'star', color: '#FF7FB4' },
  { top: '88%', left: '40%', size: 16, opacity: 0.75, duration: 4.5, delay: 0.8, kind: 'star', color: '#B85FCC' },
  { top: '10%', left: '48%', size: 20, opacity: 0.6, duration: 6, delay: 0.6, kind: 'sparkle', color: '#B85FCC' },
  { top: '55%', left: '10%', size: 16, opacity: 0.55, duration: 5.5, delay: 1.6, kind: 'sparkle', color: '#4FB6E0', hideOnMobile: true },
  { top: '30%', left: '4%', size: 40, opacity: 0.5, duration: 16, delay: 0.5, kind: 'rainbow', color: '' },
];

function CloudIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg
      style={{ width: size, height: size, color }}
      viewBox="0 0 24 24"
      fill={color}
      fillOpacity={0.25}
      stroke={color}
      strokeWidth={1.75}
    >
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h.79a4.5 4.5 0 1 1 0 9Z" />
    </svg>
  );
}

function StarIcon({ size, color, delay }: { size: number; color: string; delay: number }) {
  return (
    <svg
      className="pony-floater-twinkle"
      style={{ width: size, height: size, color, animationDelay: `${delay}s` }}
      viewBox="0 0 24 24"
      fill={color}
      stroke={color}
      strokeWidth={1.75}
    >
      <path d="M12 2l2.9 6.6L22 9.3l-5 4.9 1.2 7.1L12 17.8l-6.2 3.5L7 14.2 2 9.3l7.1-.7z" />
    </svg>
  );
}

function SparkleIcon({ size, color, delay }: { size: number; color: string; delay: number }) {
  return (
    <svg
      className="pony-floater-twinkle"
      style={{ width: size, height: size, color, animationDelay: `${delay}s` }}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.75}
    >
      <path d="M12 3l1.5 5L19 9.5l-5 1.5L12 16l-1.5-5L5 9.5l5-1.5z" />
    </svg>
  );
}

function RainbowIcon({ w, h }: { w: number; h: number }) {
  return (
    <svg viewBox="0 0 64 40" style={{ width: w, height: h }} fill="none">
      <path d="M4 38a28 28 0 0 1 56 0" stroke="#FF7FB4" strokeWidth={6} strokeLinecap="round" />
      <path d="M12 38a20 20 0 0 1 40 0" stroke="#FFC24B" strokeWidth={6} strokeLinecap="round" />
      <path d="M20 38a12 12 0 0 1 24 0" stroke="#4FB6E0" strokeWidth={6} strokeLinecap="round" />
    </svg>
  );
}

export default function Floaters() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {FLOATERS.map((f, i) => {
        const classes = [
          'pony-floater',
          f.duration > 10 ? 'pony-floater-slow' : '',
          f.hideOnMobile ? 'hidden sm:block' : '',
        ].join(' ');

        return (
          <div
            key={i}
            className={classes}
            style={{
              top: f.top,
              left: f.left,
              opacity: f.opacity,
              animationDuration: `${f.duration}s`,
              animationDelay: `${f.delay}s`,
            }}
          >
            {f.kind === 'cloud' && <CloudIcon size={f.size} color={f.color} />}
            {f.kind === 'star' && <StarIcon size={f.size} color={f.color} delay={f.delay} />}
            {f.kind === 'sparkle' && <SparkleIcon size={f.size} color={f.color} delay={f.delay} />}
            {f.kind === 'rainbow' && <RainbowIcon w={f.size} h={f.size * 0.6} />}
          </div>
        );
      })}
    </div>
  );
}
