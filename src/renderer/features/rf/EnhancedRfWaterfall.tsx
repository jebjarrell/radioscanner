/**
 * Enhanced RF Waterfall Display
 *
 * Professional waterfall display using WaterfallCanvas with:
 * - Frequency axis with auto-scaled labels
 * - Colorbar legend
 * - Smooth scrolling with color palette
 * - Configurable color scheme
 *
 * @see RF_VISUALIZATION_PLAN.md
 */

import React, { useEffect, useRef } from 'react';

import type { RfSpectrumFrame } from '../../hooks/useRfStream';
import { useSettings } from '../../hooks/useSettings';
import { WaterfallCanvas } from '../../waterfall/WaterfallCanvas';

interface Props {
  frame: RfSpectrumFrame | null;
}

const formatFrequency = (hz: number): string => {
  if (hz >= 1e9) return `${(hz / 1e9).toFixed(2)} GHz`;
  if (hz >= 1e6) return `${(hz / 1e6).toFixed(2)} MHz`;
  if (hz >= 1e3) return `${(hz / 1e3).toFixed(1)} kHz`;
  return `${hz.toFixed(0)} Hz`;
};

export const EnhancedRfWaterfall: React.FC<Props> = ({ frame }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const waterfallRef = useRef<WaterfallCanvas | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const { settings } = useSettings();

  // Initialize WaterfallCanvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    try {
      // Get maxRows from settings, default to 100
      const maxRows = settings?.performance?.waterfallMaxRows ?? 100;

      // Create waterfall with custom color palette
      waterfallRef.current = new WaterfallCanvas(canvas, {
        maxRows,
        colorStops: [
          { stop: 0, color: [0, 0, 20] }, // Dark blue (weak)
          { stop: 0.2, color: [0, 32, 128] }, // Blue
          { stop: 0.4, color: [0, 128, 255] }, // Cyan
          { stop: 0.6, color: [128, 255, 128] }, // Green
          { stop: 0.8, color: [255, 200, 0] }, // Yellow
          { stop: 1.0, color: [255, 50, 50] }, // Red (strong)
        ],
      });
    } catch (error) {
      console.error('[EnhancedRfWaterfall] Failed to create WaterfallCanvas:', error);
    }

    return () => {
      if (waterfallRef.current) {
        waterfallRef.current.terminate();
        waterfallRef.current = null;
      }
    };
  }, [settings?.performance?.waterfallMaxRows]);

  // Push new spectrum data to waterfall
  useEffect(() => {
    const waterfall = waterfallRef.current;
    if (!waterfall || !frame || frame.bins.length === 0) {
      return;
    }

    // Convert dB to magnitude (0-1 range)
    const magnitudes = new Float32Array(frame.bins.length);
    for (let i = 0; i < frame.bins.length; i++) {
      const db = frame.bins[i];
      // Convert dB to linear scale (assuming -100 to 0 dB range)
      const linear = Math.pow(10, db / 10);
      magnitudes[i] = Math.max(0, Math.min(linear, 1));
    }

    waterfall.pushRow(magnitudes);
  }, [frame]);

  // Draw frequency axis overlay
  useEffect(() => {
    const overlayCanvas = overlayCanvasRef.current;
    if (!overlayCanvas || !frame) {
      return;
    }

    const ctx = overlayCanvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const width = overlayCanvas.clientWidth || 600;
    const height = overlayCanvas.clientHeight || 30;

    overlayCanvas.width = width * dpr;
    overlayCanvas.height = height * dpr;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Draw frequency axis
    drawFrequencyAxis(ctx, frame, width);

    ctx.restore();
  }, [frame]);

  const drawFrequencyAxis = (
    ctx: CanvasRenderingContext2D,
    frame: RfSpectrumFrame,
    width: number,
  ) => {
    const startHz = frame.startHz;
    const endHz = frame.startHz + frame.bins.length * frame.binSizeHz;

    ctx.fillStyle = '#aaa';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';

    // Draw frequency labels
    for (let i = 0; i <= 5; i++) {
      const freq = startHz + (i / 5) * (endHz - startHz);
      const xPos = (i / 5) * width;
      const label = formatFrequency(freq);
      ctx.fillText(label, xPos, 18);
    }

    // Tick marks
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;

    for (let i = 0; i <= 5; i++) {
      const xPos = (i / 5) * width;
      ctx.beginPath();
      ctx.moveTo(xPos, 0);
      ctx.lineTo(xPos, 5);
      ctx.stroke();
    }
  };

  return (
    <div style={{ width: '100%', position: 'relative', background: '#1a1a1a' }}>
      {/* Waterfall canvas */}
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '200px',
          display: 'block',
          imageRendering: 'pixelated', // Sharp pixels
        }}
      />

      {/* Frequency axis overlay */}
      <canvas
        ref={overlayCanvasRef}
        style={{
          width: '100%',
          height: '30px',
          display: 'block',
        }}
      />

      {/* Colorbar legend */}
      <div
        style={{
          position: 'absolute',
          right: 10,
          top: 10,
          width: 20,
          height: 180,
          background: 'linear-gradient(to top, #001428, #0080ff, #80ff80, #ffc800, #ff3232)',
          border: '1px solid #666',
          borderRadius: '3px',
        }}
      />

      {/* Colorbar labels */}
      <div
        style={{
          position: 'absolute',
          right: 35,
          top: 10,
          height: 180,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          fontSize: '9px',
          color: '#aaa',
          fontFamily: 'monospace',
        }}
      >
        <span>0 dB</span>
        <span>-20</span>
        <span>-40</span>
        <span>-60</span>
        <span>-80</span>
        <span>-100</span>
      </div>
    </div>
  );
};
