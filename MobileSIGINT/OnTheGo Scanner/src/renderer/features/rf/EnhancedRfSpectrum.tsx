/**
 * Enhanced RF Spectrum Display
 *
 * Professional spectrum analyzer with:
 * - Frequency axis with auto-scaled labels
 * - Power (dB) axis with grid lines
 * - Peak markers with de-overlapped labels
 * - Hold and Max Hold features
 * - Gradient fill
 * - Redraw on container resize
 *
 * @see RF_VISUALIZATION_PLAN.md
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

import type { RfSpectrumFrame } from '../../hooks/useRfStream';
import { formatFrequency, formatPower } from '../../utils/frequency';

interface Props {
  frame: RfSpectrumFrame | null;
}

const MIN_DB = -100;
const MAX_DB = 0;
const PEAK_LABEL_COUNT = 5;
const PEAK_LABEL_MIN_GAP_PX = 42;

const clampDb = (value: number): number => Math.max(MIN_DB, Math.min(MAX_DB, value));

export const EnhancedRfSpectrum: React.FC<Props> = ({ frame }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<RfSpectrumFrame | null>(null);
  const holdBinsRef = useRef<number[] | null>(null);
  const maxHoldBinsRef = useRef<number[] | null>(null);
  const [holdEnabled, setHoldEnabled] = useState(false);
  const [maxHoldEnabled, setMaxHoldEnabled] = useState(false);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const currentFrame = frameRef.current;

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

    drawGrid(ctx, marginLeft, marginTop, plotWidth, plotHeight);
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

    const displayBins =
      holdEnabled && holdBinsRef.current ? holdBinsRef.current : currentFrame.bins;

    // Draw max hold trace behind the live trace
    if (maxHoldEnabled && maxHoldBinsRef.current) {
      drawTrace(
        ctx,
        maxHoldBinsRef.current,
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
    if (currentFrame.peaks?.length && !holdEnabled) {
      drawPeaks(ctx, currentFrame, displayBins, marginLeft, marginTop, plotWidth, plotHeight);
    }

    ctx.restore();
  }, [holdEnabled, maxHoldEnabled]);

  // Size the canvas backing store to its CSS box and observe container resizes
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
        draw();
      }
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [draw]);

  // Ingest each new frame: update hold/max-hold accumulators, then redraw
  useEffect(() => {
    frameRef.current = frame;
    if (!frame || frame.bins.length === 0) {
      return;
    }

    if (holdEnabled && !holdBinsRef.current) {
      holdBinsRef.current = [...frame.bins];
    }

    if (maxHoldEnabled) {
      const prev = maxHoldBinsRef.current;
      if (!prev || prev.length !== frame.bins.length) {
        maxHoldBinsRef.current = [...frame.bins];
      } else {
        for (let i = 0; i < frame.bins.length; i++) {
          if (frame.bins[i] > prev[i]) {
            prev[i] = frame.bins[i];
          }
        }
      }
    }

    draw();
  }, [frame, holdEnabled, maxHoldEnabled, draw]);

  const drawGrid = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 0.5;

    // Horizontal grid lines (every 10 dB)
    for (let db = MIN_DB + 10; db <= MAX_DB; db += 10) {
      const yPos = y + h - ((db - MIN_DB) / (MAX_DB - MIN_DB)) * h;
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
    currentFrame: RfSpectrumFrame,
    x: number,
    y: number,
    w: number,
    h: number,
    marginBottom: number,
  ) => {
    const startHz = currentFrame.startHz;
    const endHz = currentFrame.startHz + currentFrame.bins.length * currentFrame.binSizeHz;

    ctx.fillStyle = '#aaa';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';

    // Label count adapts to width so ~80px-wide labels never overlap
    const divisions = Math.max(2, Math.min(5, Math.floor(w / 85)));
    for (let i = 0; i <= divisions; i++) {
      const freq = startHz + (i / divisions) * (endHz - startHz);
      const xPos = x + (i / divisions) * w;
      ctx.fillText(formatFrequency(freq), xPos, y + h + 18);
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
    for (let db = MIN_DB + 10; db <= MAX_DB; db += 10) {
      const yPos = y + h - ((db - MIN_DB) / (MAX_DB - MIN_DB)) * h;
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
      const yPos = y + h - ((clampDb(value) - MIN_DB) / (MAX_DB - MIN_DB)) * h;

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
    currentFrame: RfSpectrumFrame,
    bins: number[],
    x: number,
    y: number,
    w: number,
    h: number,
  ) => {
    if (!currentFrame.peaks) return;

    // Peaks arrive sorted by SNR (strongest first), so labels go to the
    // strongest peaks and weaker neighbors are skipped when they would overlap.
    const labeledXs: number[] = [];

    currentFrame.peaks.forEach((peak: { frequency: number; power: number }, index: number) => {
      const bin = Math.round((peak.frequency - currentFrame.startHz) / currentFrame.binSizeHz);
      if (bin < 0 || bin >= bins.length) return;

      const xPos = x + (bin / (bins.length - 1 || 1)) * w;
      const yPos = y + h - ((clampDb(peak.power) - MIN_DB) / (MAX_DB - MIN_DB)) * h;

      // Draw marker
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(xPos - 1.5, yPos - 5, 3, 10);

      if (index >= PEAK_LABEL_COUNT) return;

      // Skip the label if it would collide with an already-drawn one
      if (labeledXs.some((lx) => Math.abs(lx - xPos) < PEAK_LABEL_MIN_GAP_PX)) return;
      labeledXs.push(xPos);

      // Clamp the label x so text stays inside the plot area
      const labelX = Math.max(x + 25, Math.min(x + w - 25, xPos));
      const labelY = Math.max(y + 22, yPos - 10);

      ctx.save();
      ctx.fillStyle = '#fff';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(formatFrequency(peak.frequency), labelX, labelY);
      ctx.fillText(formatPower(peak.power), labelX, labelY - 10);
      ctx.restore();
    });
  };

  const toggleHold = () => {
    if (holdEnabled) {
      holdBinsRef.current = null;
      setHoldEnabled(false);
    } else {
      holdBinsRef.current = frameRef.current ? [...frameRef.current.bins] : null;
      setHoldEnabled(true);
    }
  };

  const toggleMaxHold = () => {
    if (maxHoldEnabled) {
      maxHoldBinsRef.current = null;
      setMaxHoldEnabled(false);
    } else {
      maxHoldBinsRef.current = frameRef.current ? [...frameRef.current.bins] : null;
      setMaxHoldEnabled(true);
    }
  };

  const clearMaxHold = () => {
    maxHoldBinsRef.current = frameRef.current ? [...frameRef.current.bins] : null;
    draw();
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
            background: holdEnabled ? '#3498db' : '#555',
            color: '#fff',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
          }}
        >
          {holdEnabled ? 'Unhold' : 'Hold'}
        </button>
        <button
          onClick={toggleMaxHold}
          style={{
            padding: '4px 8px',
            fontSize: '11px',
            background: maxHoldEnabled ? '#e74c3c' : '#555',
            color: '#fff',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
          }}
        >
          {maxHoldEnabled ? 'Max: On' : 'Max Hold'}
        </button>
        {maxHoldEnabled && (
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
