/**
 * Enhanced RF Spectrum Display
 *
 * Professional spectrum analyzer with:
 * - Frequency axis with auto-scaled labels
 * - Power (dB) axis with grid lines
 * - Peak markers with tooltips
 * - Hold and Max Hold features
 * - Gradient fill
 * - Anti-aliased rendering
 *
 * @see RF_VISUALIZATION_PLAN.md
 */

import React, { useEffect, useRef, useState } from 'react';

import type { RfSpectrumFrame } from '../../hooks/useRfStream';

interface Props {
  frame: RfSpectrumFrame | null;
}

interface HoldState {
  enabled: boolean;
  bins: number[] | null;
}

interface MaxHoldState {
  enabled: boolean;
  bins: number[];
}

const clampDb = (value: number): number => Math.max(-100, Math.min(0, value));

const formatFrequency = (hz: number): string => {
  if (hz >= 1e9) return `${(hz / 1e9).toFixed(2)} GHz`;
  if (hz >= 1e6) return `${(hz / 1e6).toFixed(2)} MHz`;
  if (hz >= 1e3) return `${(hz / 1e3).toFixed(1)} kHz`;
  return `${hz.toFixed(0)} Hz`;
};

const formatPower = (db: number): string => {
  return `${db.toFixed(1)} dB`;
};

export const EnhancedRfSpectrum: React.FC<Props> = ({ frame }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hold, setHold] = useState<HoldState>({ enabled: false, bins: null });
  const [maxHold, setMaxHold] = useState<MaxHoldState>({ enabled: false, bins: [] });

  // Handle canvas resizing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth || 600;
      const height = canvas.clientHeight || 200;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
      }
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Update hold state
  useEffect(() => {
    if (hold.enabled && frame && frame.bins.length > 0) {
      if (!hold.bins) {
        setHold({ enabled: true, bins: [...frame.bins] });
      }
    }
  }, [hold.enabled, frame]);

  // Update max hold state
  useEffect(() => {
    if (maxHold.enabled && frame && frame.bins.length > 0) {
      if (maxHold.bins.length === 0) {
        setMaxHold({ enabled: true, bins: [...frame.bins] });
      } else {
        const updated = frame.bins.map((val, i) => Math.max(val, maxHold.bins[i] || val));
        setMaxHold({ enabled: true, bins: updated });
      }
    }
  }, [maxHold.enabled, frame]);

  // Render spectrum
  useEffect(() => {
    const canvas = canvasRef.current;
    const currentFrame = frame;

    if (!canvas || !currentFrame || currentFrame.bins.length === 0) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    // Margins for axes
    const marginLeft = 50;
    const marginRight = 10;
    const marginTop = 10;
    const marginBottom = 30;

    const plotWidth = width - marginLeft - marginRight;
    const plotHeight = height - marginTop - marginBottom;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Draw background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(marginLeft, marginTop, plotWidth, plotHeight);

    // Draw grid
    drawGrid(ctx, marginLeft, marginTop, plotWidth, plotHeight);

    // Draw axes
    drawFrequencyAxis(
      ctx,
      currentFrame,
      marginLeft,
      marginTop,
      plotWidth,
      plotHeight,
      marginBottom,
    );
    drawPowerAxis(ctx, marginLeft, marginTop, plotWidth, plotHeight);

    // Get bins to display
    const bins = currentFrame.bins;
    const displayBins = hold.enabled && hold.bins ? hold.bins : bins;

    // Draw max hold if enabled
    if (maxHold.enabled && maxHold.bins.length > 0) {
      drawTrace(
        ctx,
        maxHold.bins,
        marginLeft,
        marginTop,
        plotWidth,
        plotHeight,
        '#ff6b6b',
        1,
        false,
      );
    }

    // Draw main trace with gradient
    drawTrace(ctx, displayBins, marginLeft, marginTop, plotWidth, plotHeight, '#2ecc71', 2, true);

    // Draw peaks
    if (currentFrame.peaks?.length && !hold.enabled) {
      drawPeaks(ctx, currentFrame, displayBins, marginLeft, marginTop, plotWidth, plotHeight);
    }

    ctx.restore();
  }, [frame, hold, maxHold]);

  const drawGrid = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 0.5;

    // Horizontal grid lines (every 10 dB)
    for (let db = -90; db <= 0; db += 10) {
      const yPos = y + h - ((db + 100) / 100) * h;
      ctx.beginPath();
      ctx.moveTo(x, yPos);
      ctx.lineTo(x + w, yPos);
      ctx.stroke();
    }

    // Vertical grid lines (every 20%)
    for (let i = 0; i <= 5; i++) {
      const xPos = x + (i / 5) * w;
      ctx.beginPath();
      ctx.moveTo(xPos, y);
      ctx.lineTo(xPos, y + h);
      ctx.stroke();
    }
  };

  const drawFrequencyAxis = (
    ctx: CanvasRenderingContext2D,
    frame: RfSpectrumFrame,
    x: number,
    y: number,
    w: number,
    h: number,
    marginBottom: number,
  ) => {
    const startHz = frame.startHz;
    const endHz = frame.startHz + frame.bins.length * frame.binSizeHz;

    ctx.fillStyle = '#aaa';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';

    // Draw 5 frequency labels
    for (let i = 0; i <= 5; i++) {
      const freq = startHz + (i / 5) * (endHz - startHz);
      const xPos = x + (i / 5) * w;
      const label = formatFrequency(freq);
      ctx.fillText(label, xPos, y + h + 18);
    }

    // Axis label
    ctx.fillText('Frequency', x + w / 2, y + h + marginBottom - 2);
  };

  const drawPowerAxis = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
  ) => {
    ctx.fillStyle = '#aaa';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';

    // Draw dB labels every 10 dB
    for (let db = -90; db <= 0; db += 10) {
      const yPos = y + h - ((db + 100) / 100) * h;
      ctx.fillText(`${db}`, x - 5, yPos + 3);
    }

    // Axis label (rotated)
    ctx.save();
    ctx.translate(12, y + h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('Power (dBFS)', 0, 0);
    ctx.restore();
  };

  const drawTrace = (
    ctx: CanvasRenderingContext2D,
    bins: number[],
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    lineWidth: number,
    fill: boolean,
  ) => {
    if (bins.length === 0) return;

    ctx.beginPath();

    bins.forEach((value: number, index: number) => {
      const xPos = x + (index / (bins.length - 1 || 1)) * w;
      const yPos = y + h - ((clampDb(value) + 100) / 100) * h;

      if (index === 0) {
        ctx.moveTo(xPos, yPos);
      } else {
        ctx.lineTo(xPos, yPos);
      }
    });

    // Fill gradient if requested
    if (fill) {
      const gradient = ctx.createLinearGradient(0, y, 0, y + h);
      gradient.addColorStop(0, color + '80'); // 50% opacity
      gradient.addColorStop(1, color + '00'); // transparent

      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    // Draw line
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  };

  const drawPeaks = (
    ctx: CanvasRenderingContext2D,
    frame: RfSpectrumFrame,
    bins: number[],
    x: number,
    y: number,
    w: number,
    h: number,
  ) => {
    if (!frame.peaks) return;

    ctx.fillStyle = '#e74c3c';

    frame.peaks.forEach((peak: { frequency: number; power: number }) => {
      const bin = Math.round((peak.frequency - frame.startHz) / frame.binSizeHz);
      if (bin < 0 || bin >= bins.length) return;

      const xPos = x + (bin / (bins.length - 1 || 1)) * w;
      const yPos = y + h - ((clampDb(peak.power) + 100) / 100) * h;

      // Draw marker
      ctx.fillRect(xPos - 1.5, yPos - 5, 3, 10);

      // Draw label for top peaks
      if (frame.peaks && frame.peaks.indexOf(peak) < 5) {
        ctx.save();
        ctx.fillStyle = '#fff';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(formatFrequency(peak.frequency), xPos, yPos - 10);
        ctx.fillText(formatPower(peak.power), xPos, yPos - 20);
        ctx.restore();
      }
    });
  };

  const toggleHold = () => {
    if (hold.enabled) {
      setHold({ enabled: false, bins: null });
    } else {
      setHold({ enabled: true, bins: frame ? [...frame.bins] : null });
    }
  };

  const toggleMaxHold = () => {
    if (maxHold.enabled) {
      setMaxHold({ enabled: false, bins: [] });
    } else {
      setMaxHold({ enabled: true, bins: frame ? [...frame.bins] : [] });
    }
  };

  const clearMaxHold = () => {
    setMaxHold({ enabled: maxHold.enabled, bins: frame ? [...frame.bins] : [] });
  };

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      <canvas
        ref={canvasRef}
        width={600}
        height={200}
        style={{ width: '100%', height: 200, display: 'block' }}
      />
      <div style={{ position: 'absolute', top: 5, right: 5, display: 'flex', gap: '5px' }}>
        <button
          onClick={toggleHold}
          style={{
            padding: '4px 8px',
            fontSize: '11px',
            background: hold.enabled ? '#3498db' : '#555',
            color: '#fff',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
          }}
        >
          {hold.enabled ? 'Unhold' : 'Hold'}
        </button>
        <button
          onClick={toggleMaxHold}
          style={{
            padding: '4px 8px',
            fontSize: '11px',
            background: maxHold.enabled ? '#e74c3c' : '#555',
            color: '#fff',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
          }}
        >
          {maxHold.enabled ? 'Max' : 'Max'}
        </button>
        {maxHold.enabled && (
          <button
            onClick={clearMaxHold}
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              background: '#666',
              color: '#fff',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
};
