import React, { useEffect, useRef } from 'react';

import type { RfSpectrumFrame } from '../../hooks/useRfStream';

const clampDb = (value: number): number => Math.max(-100, Math.min(0, value));

interface Props {
  frame: RfSpectrumFrame | null;
}

export const RfSpectrum: React.FC<Props> = ({ frame }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth || 600;
      const height = canvas.clientHeight || 140;
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
      }
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const currentFrame = frame;
    if (!canvas || !currentFrame) {
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx || currentFrame.bins.length === 0) {
      return;
    }
    const dpr = window.devicePixelRatio || 1;
    const width = (canvas.clientWidth || 600) * dpr;
    const height = (canvas.clientHeight || 140) * dpr;
    const bins = currentFrame.bins;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width / dpr, height / dpr);

    ctx.beginPath();
    bins.forEach((value: number, index: number) => {
      const x = (index / (bins.length - 1 || 1)) * (width / dpr);
      const y = (1 - (clampDb(value) + 100) / 100) * (height / dpr);
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.strokeStyle = '#2ecc71';
    ctx.lineWidth = 1;
    ctx.stroke();

    if (currentFrame.peaks?.length) {
      ctx.fillStyle = '#e74c3c';
      currentFrame.peaks.forEach((peak: { frequency: number; power: number }) => {
        const bin = Math.round((peak.frequency - currentFrame.startHz) / currentFrame.binSizeHz);
        const x = (bin / (bins.length - 1 || 1)) * (width / dpr);
        ctx.fillRect(x - 1, 0, 2, height / dpr);
      });
    }

    ctx.restore();
  }, [frame]);

  return <canvas ref={canvasRef} width={600} height={140} style={{ width: '100%', height: 140 }} />;
};
