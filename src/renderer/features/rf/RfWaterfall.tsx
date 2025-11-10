import React, { useEffect, useRef } from 'react';

import type { RfSpectrumFrame } from '../../hooks/useRfStream';

interface Props {
  frame: RfSpectrumFrame | null;
}

export const RfWaterfall: React.FC<Props> = ({ frame }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const tempCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL('./waterfallWorker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

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

  useEffect(() => {
    const canvas = canvasRef.current;
    const worker = workerRef.current;
    if (!canvas || !worker || !frame || frame.bins.length === 0) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width;
    const height = canvas.height;

    ctx.imageSmoothingEnabled = false;

    if (width === 0 || height === 0) {
      return;
    }

    if (height > dpr) {
      const imageData = ctx.getImageData(0, 0, width, height - dpr);
      ctx.putImageData(imageData, 0, dpr);
    }

    const listener = (event: MessageEvent<ImageData>) => {
      const image = event.data;
      if (!tempCanvasRef.current) {
        tempCanvasRef.current = document.createElement('canvas');
      }
      const tmp = tempCanvasRef.current;
      tmp.width = image.width;
      tmp.height = 1;
      const tmpCtx = tmp.getContext('2d');
      if (!tmpCtx) {
        return;
      }
      tmpCtx.putImageData(image, 0, 0);
      ctx.drawImage(tmp, 0, 0, tmp.width, 1, 0, 0, width, dpr);
      worker.removeEventListener('message', listener);
    };

    worker.addEventListener('message', listener);
    const bins = new Float32Array(frame.bins);
    worker.postMessage({ bins }, [bins.buffer]);

    return () => {
      worker.removeEventListener('message', listener);
    };
  }, [frame]);

  return <canvas ref={canvasRef} width={600} height={200} style={{ width: '100%', height: 200 }} />;
};
