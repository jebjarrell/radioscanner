/// <reference lib="webworker" />

const clampDb = (value: number): number => Math.max(-100, Math.min(0, value));

self.onmessage = (event: MessageEvent<{ bins: Float32Array }>) => {
  const { bins } = event.data;
  const length = bins.length;
  const image = new ImageData(length, 1);
  for (let i = 0; i < length; i++) {
    const v = clampDb(bins[i]);
    const shade = Math.floor(((v + 100) / 100) * 255);
    const idx = i * 4;
    image.data[idx] = shade;
    image.data[idx + 1] = shade;
    image.data[idx + 2] = shade;
    image.data[idx + 3] = 255;
  }
  postMessage(image, [image.data.buffer]);
};

export {};
