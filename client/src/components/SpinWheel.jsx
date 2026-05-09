import { useRef, useEffect, useState, useCallback } from 'react';

const PRIZES = [
  { id: 'gift_card', label: '$25 Gift Card',       lines: ['$25', 'Gift Card'],   emoji: '🏆', weight: 1,   color: '#16A34A' },
  { id: 'half_day',  label: 'Half Day Off',         lines: ['Half', 'Day Off'],    emoji: '🎟️', weight: 1,   color: '#2563EB' },
  { id: 'lunch',     label: 'Team Lunch',           lines: ['Team', 'Lunch'],      emoji: '🍕', weight: 1,   color: '#EA580C' },
  { id: 'cash_50',   label: '$50 Cash',             lines: ['$50', 'Cash'],        emoji: '💵', weight: 1,   color: '#9333EA' },
  { id: 'cash_100',  label: '$100 Cash',            lines: ['$100', 'Cash'],       emoji: '🎉', weight: 0.5, color: '#B45309' },
  { id: 'swag',      label: 'Agency Swag',          lines: ['Agency', 'Swag'],     emoji: '🧢', weight: 1,   color: '#BE185D' },
  { id: 'trophy',    label: 'Top Performer Trophy', lines: ['Top', 'Trophy'],      emoji: '🎯', weight: 1,   color: '#CC0000' },
];

const TOTAL_WEIGHT = PRIZES.reduce((s, p) => s + p.weight, 0);

function lighten(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, (n >> 16) + amt);
  const g = Math.min(255, ((n >> 8) & 0xff) + amt);
  const b = Math.min(255, (n & 0xff) + amt);
  return `rgb(${r},${g},${b})`;
}

export default function SpinWheel({ onClose }) {
  const canvasRef = useRef(null);
  const rotationRef = useRef(0);
  const animRef = useRef(null);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState(null);

  const getSlices = useCallback(() => {
    let cumul = -Math.PI / 2;
    return PRIZES.map(prize => {
      const angle = (prize.weight / TOTAL_WEIGHT) * Math.PI * 2;
      const slice = { prize, startAngle: cumul, endAngle: cumul + angle, midAngle: cumul + angle / 2, angleDeg: (angle * 180) / Math.PI };
      cumul += angle;
      return slice;
    });
  }, []);

  const drawWheel = useCallback((ctx, rotation) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const radius = Math.min(cx, cy) - 20;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const slices = getSlices();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);

    for (const slice of slices) {
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
      grad.addColorStop(0, lighten(slice.prize.color, 25));
      grad.addColorStop(1, slice.prize.color);

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, slice.startAngle, slice.endAngle);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const mid = slice.midAngle;
      const textR = radius * 0.63;
      const baseFont = Math.floor(radius * 0.085);
      const smallSlice = slice.angleDeg < 35;

      ctx.save();
      ctx.rotate(mid);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 4;

      if (smallSlice) {
        ctx.font = `800 ${Math.floor(baseFont * 0.9)}px Inter, sans-serif`;
        ctx.fillStyle = '#ffffff';
        ctx.fillText('$100', textR, -baseFont * 0.4);
        ctx.font = `600 ${Math.floor(baseFont * 0.75)}px Inter, sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillText('Cash', textR, baseFont * 0.55);
      } else {
        ctx.font = `${Math.floor(radius * 0.115)}px serif`;
        ctx.fillText(slice.prize.emoji, textR, -baseFont * 1.3);
        ctx.font = `700 ${baseFont}px Inter, sans-serif`;
        ctx.fillStyle = '#ffffff';
        slice.prize.lines.forEach((line, i) => {
          const total = slice.prize.lines.length;
          const y = (i - (total - 1) / 2) * (baseFont * 1.25) + baseFont * 0.7;
          ctx.fillText(line, textR, y);
        });
      }
      ctx.restore();
    }

    ctx.restore();

    // Outer ring
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.arc(0, 0, radius + 4, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,184,0,0.3)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Center hub
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#0F1729';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,184,0,0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Gold pointer
    ctx.save();
    ctx.translate(cx, cy - radius - 1);
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(-10, 14);
    ctx.lineTo(10, 14);
    ctx.closePath();
    ctx.fillStyle = '#FFB800';
    ctx.shadowColor = 'rgba(255,184,0,0.7)';
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.restore();
  }, [getSlices]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const size = Math.min(window.innerWidth - 80, 340);
    canvas.width = size;
    canvas.height = size;
    drawWheel(canvas.getContext('2d'), rotationRef.current);
  }, [drawWheel]);

  const spin = useCallback(() => {
    if (spinning) return;
    setSpinning(true);
    setWinner(null);

    let rand = Math.random() * TOTAL_WEIGHT;
    let selectedPrize = PRIZES[PRIZES.length - 1];
    for (const prize of PRIZES) {
      rand -= prize.weight;
      if (rand <= 0) { selectedPrize = prize; break; }
    }

    const slices = getSlices();
    const winnerSlice = slices.find(s => s.prize.id === selectedPrize.id);
    const targetMid = winnerSlice.midAngle;
    const currentRot = rotationRef.current;
    const base = -Math.PI / 2 - targetMid;
    const normalized = ((base % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const currentNorm = ((currentRot % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const delta = (normalized - currentNorm + 2 * Math.PI) % (2 * Math.PI);
    const finalRotation = currentRot + (5 + Math.floor(Math.random() * 3)) * 2 * Math.PI + delta;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const duration = 5000 + Math.random() * 1200;
    const startTime = performance.now();
    const startRot = currentRot;

    function animate(now) {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 4);
      const rot = startRot + (finalRotation - startRot) * eased;
      rotationRef.current = rot;
      drawWheel(ctx, rot);
      if (t < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        setSpinning(false);
        setWinner(selectedPrize);
      }
    }

    animRef.current = requestAnimationFrame(animate);
  }, [spinning, getSlices, drawWheel]);

  useEffect(() => () => { if (animRef.current) cancelAnimationFrame(animRef.current); }, []);

  return (
    <div className="wheel-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="wheel-modal">
        <button className="wheel-close" onClick={onClose}>✕</button>
        <div className="wheel-title">Prize Wheel</div>
        <div className="wheel-subtitle">$100 Cash has half the slice — good luck!</div>

        <div className="wheel-canvas-wrap">
          <canvas ref={canvasRef} />
        </div>

        {winner && (
          <div className="winner-banner">
            <span className="winner-emoji">{winner.emoji}</span>
            <div className="winner-text">
              <div className="winner-name">{winner.label}</div>
              <div className="winner-sub">You won this week's prize! 🎉</div>
            </div>
          </div>
        )}

        <button
          className={`wheel-spin-btn${spinning ? ' spinning' : ''}`}
          onClick={spin}
          disabled={spinning}
        >
          {spinning ? 'Spinning...' : 'Spin the Wheel'}
        </button>
      </div>
    </div>
  );
}
