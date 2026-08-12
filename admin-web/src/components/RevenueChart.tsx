import { compactMoney, dayLabel, money } from '../lib/format';
import type { SeriesPoint } from '../lib/types';

const WIDTH = 720;
const HEIGHT = 220;
const PAD_L = 52;
const PAD_R = 12;
const PAD_T = 12;
const PAD_B = 26;

/**
 * Daily gross-collections chart, drawn as plain SVG so the dashboard does not
 * pull in a charting library. viewBox scaling keeps it responsive.
 */
export function RevenueChart({ points }: { points: SeriesPoint[] }) {
  if (points.length === 0) return <div className="state">No payments in this window.</div>;

  const max = Math.max(1, ...points.map((point) => point.gross));
  const innerW = WIDTH - PAD_L - PAD_R;
  const innerH = HEIGHT - PAD_T - PAD_B;
  const step = points.length > 1 ? innerW / (points.length - 1) : 0;

  const x = (index: number) => PAD_L + (points.length > 1 ? index * step : innerW / 2);
  const y = (value: number) => PAD_T + innerH - (value / max) * innerH;

  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(point.gross).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(1)},${(PAD_T + innerH).toFixed(1)} L${x(0).toFixed(1)},${(PAD_T + innerH).toFixed(1)} Z`;

  const gridValues = [0, 0.25, 0.5, 0.75, 1].map((fraction) => max * fraction);
  // At most six date labels, so they never overlap on a 30/90-day window.
  const labelEvery = Math.max(1, Math.ceil(points.length / 6));

  return (
    <>
      <svg className="chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" role="img" aria-label="Daily gross collections">
        <defs>
          <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0f766e" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#0f766e" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {gridValues.map((value) => (
          <g key={value}>
            <line x1={PAD_L} x2={WIDTH - PAD_R} y1={y(value)} y2={y(value)} stroke="#e2e8f0" strokeWidth="1" />
            <text x={PAD_L - 8} y={y(value) + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
              {compactMoney(value)}
            </text>
          </g>
        ))}

        <path d={area} fill="url(#revenueFill)" />
        <path d={line} fill="none" stroke="#0f766e" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {points.map((point, index) => (
          <circle key={point.day} cx={x(index)} cy={y(point.gross)} r={points.length > 45 ? 0 : 2.5} fill="#0f766e">
            <title>{`${point.day} — ${money(point.gross)} from ${point.payments} payment(s)`}</title>
          </circle>
        ))}

        {points.map((point, index) => (
          index % labelEvery === 0 || index === points.length - 1 ? (
            <text key={`label-${point.day}`} x={x(index)} y={HEIGHT - 8} textAnchor="middle" fontSize="10" fill="#94a3b8">
              {dayLabel(point.day)}
            </text>
          ) : null
        ))}
      </svg>
      <div className="chart-legend" style={{ marginTop: 8 }}>
        <span><i className="legend-dot" style={{ background: '#0f766e' }} />Gross collected (deposits + balances)</span>
      </div>
    </>
  );
}
