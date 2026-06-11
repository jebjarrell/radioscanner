/// <reference lib="webworker" />

const clampDb = (value: number): number => Math.max(-100, Math.min(0, value));

self.onmessage = (event: MessageEvent<{ bins: Float32Array }>) => {
  try {
    const data = event.data;
    const bins = data?.bins;
    // Guard against malformed payloads so a bad frame can't crash the worker.
    if (!bins || typeof (bins as Float32Array).length !== 'number') {
      throw new Error('waterfallWorker: expected { bins: Float32Array }');
    }

    const length = bins.length;
    if (length === 0) {
      return;
    }

    const image = new ImageData(length, 1);
    for (let i = 0; i < length; i++) {
      const raw = bins[i];
      const v = clampDb(Number.isFinite(raw) ? raw : -100);
      const shade = Math.floor(((v + 100) / 100) * 255);
      const idx = i * 4;
      image.data[idx] = shade;
      image.data[idx + 1] = shade;
      image.data[idx + 2] = shade;
      image.data[idx + 3] = 255;
    }
    postMessage(image, [image.data.buffer]);
  } catch (err) {
    // Mirror fft.worker's convention: report failures as an error payload
    // instead of throwing, so consumers can degrade gracefully.
    postMessage({ error: String((err as Error)?.message ?? err) });
  }
};

export {};
