import FFTWorkerConstructor from '../../workers/fft.worker.js?worker';

const DEFAULT_MAX_ROWS = 100;
const DEFAULT_COLOR_STOPS: ReadonlyArray<{
  stop: number;
  color: [number, number, number];
}> = [
  { stop: 0, color: [0, 0, 0] },
  { stop: 0.25, color: [0, 32, 128] },
  { stop: 0.5, color: [0, 128, 255] },
  { stop: 0.75, color: [255, 200, 0] },
  { stop: 1, color: [255, 255, 255] },
];
const MAG_EPSILON = 1e-9;

type RingBufferSlot = Float32Array | null;

export interface WaterfallCanvasOptions {
  maxRows?: number;
  colorStops?: ReadonlyArray<{
    stop: number;
    color: [number, number, number];
  }>;
}

export class WaterfallCanvas {
  public readonly worker: Worker;

  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private maxRows: number;
  private ring: RingBufferSlot[];
  private readonly palette: Uint8ClampedArray;

  private readonly colorStops: ReadonlyArray<{
    stop: number;
    color: [number, number, number];
  }>;

  private writeIndex = 0;
  private rowCount = 0;
  private fftSize: number | null = null;
  private minMagnitude = Number.POSITIVE_INFINITY;
  private maxMagnitude = 0;
  private minLog = Math.log10(MAG_EPSILON);
  private maxLog = Math.log10(1);

  constructor(canvas: HTMLCanvasElement, options?: WaterfallCanvasOptions) {
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new TypeError('WaterfallCanvas expects an HTMLCanvasElement.');
    }

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      throw new Error('WaterfallCanvas: 2D rendering context unavailable.');
    }

    this.canvas = canvas;
    this.ctx = ctx;

    this.maxRows = Math.min(
      DEFAULT_MAX_ROWS,
      Math.max(1, Math.floor(options?.maxRows ?? DEFAULT_MAX_ROWS)),
    );

    this.colorStops = (options?.colorStops ?? DEFAULT_COLOR_STOPS).slice().sort((a, b) => {
      if (a.stop === b.stop) {
        return 0;
      }
      return a.stop < b.stop ? -1 : 1;
    });

    this.palette = this.buildPalette(this.colorStops);
    this.ring = this.createRing(this.maxRows);
    this.syncCanvasSize(1);

    this.worker = new FFTWorkerConstructor();
    this.worker.addEventListener('message', this.handleWorkerMessage);
    this.worker.addEventListener('error', this.handleWorkerError);
  }

  public pushRow(magnitudes: Float32Array): void {
    if (!(magnitudes instanceof Float32Array)) {
      throw new TypeError('pushRow expects a Float32Array.');
    }

    if (magnitudes.length === 0) {
      return;
    }

    if (this.fftSize === null || this.fftSize !== magnitudes.length) {
      this.resetForSize(magnitudes.length);
    }

    const copy = new Float32Array(magnitudes);
    this.ring[this.writeIndex] = copy;
    this.writeIndex = (this.writeIndex + 1) % this.maxRows;
    this.rowCount = Math.min(this.rowCount + 1, this.maxRows);

    this.updateMagnitudeRange(copy);
    this.render();
  }

  public terminate(): void {
    this.worker.removeEventListener('message', this.handleWorkerMessage);
    this.worker.removeEventListener('error', this.handleWorkerError);
    this.worker.terminate();
  }

  public setMaxRows(maxRows: number): void {
    const next = Math.min(DEFAULT_MAX_ROWS, Math.max(1, Math.floor(maxRows)));
    if (next === this.maxRows) {
      return;
    }

    const rows: RingBufferSlot[] = [];
    for (let i = 0; i < this.rowCount; i++) {
      const index = (this.writeIndex - this.rowCount + i + this.maxRows) % this.maxRows;
      const entry = this.ring[index];
      if (entry) {
        rows.push(entry);
      }
    }

    const trimmed = rows.slice(Math.max(0, rows.length - next));

    this.maxRows = next;
    this.ring = this.createRing(this.maxRows);
    this.rowCount = 0;
    this.writeIndex = 0;

    trimmed.forEach((row) => {
      this.ring[this.writeIndex] = row;
      this.writeIndex = (this.writeIndex + 1) % this.maxRows;
      this.rowCount = Math.min(this.rowCount + 1, this.maxRows);
    });

    this.render();
  }

  private resetForSize(fftSize: number): void {
    this.fftSize = fftSize;
    this.writeIndex = 0;
    this.rowCount = 0;
    this.minMagnitude = Number.POSITIVE_INFINITY;
    this.maxMagnitude = 0;
    this.minLog = Math.log10(MAG_EPSILON);
    this.maxLog = Math.log10(1);
    this.ring = this.createRing(this.maxRows);
    this.syncCanvasSize(1);
    this.clearCanvas();
  }

  private syncCanvasSize(rows: number = Math.max(this.rowCount, 1)): void {
    const width = this.fftSize ?? 1;
    const height = Math.max(1, rows);

    const cssWidth = `${width}px`;
    const cssHeight = `${height}px`;

    if (this.canvas.style.width !== cssWidth) {
      this.canvas.style.width = cssWidth;
    }
    if (this.canvas.style.height !== cssHeight) {
      this.canvas.style.height = cssHeight;
    }

    if (this.canvas.width !== width) {
      this.canvas.width = width;
    }
    if (this.canvas.height !== height) {
      this.canvas.height = height;
    }
  }

  private render(): void {
    if (this.fftSize === null || this.rowCount === 0) {
      this.clearCanvas();
      return;
    }

    const rowsToDraw = this.rowCount;
    const width = this.fftSize;
    const image = this.ctx.createImageData(width, rowsToDraw);
    const data = image.data;

    for (let row = 0; row < rowsToDraw; row++) {
      const sourceIndex = (this.writeIndex - rowsToDraw + row + this.maxRows) % this.maxRows;
      const rowData = this.ring[sourceIndex];
      if (!rowData) {
        continue;
      }

      for (let x = 0; x < width; x++) {
        const normalized = this.normalize(rowData[x]);
        const paletteIndex = Math.min(255, Math.max(0, Math.round(normalized * 255)));
        const paletteOffset = paletteIndex * 3;
        const pixelOffset = (row * width + x) * 4;
        data[pixelOffset] = this.palette[paletteOffset];
        data[pixelOffset + 1] = this.palette[paletteOffset + 1];
        data[pixelOffset + 2] = this.palette[paletteOffset + 2];
        data[pixelOffset + 3] = 255;
      }
    }

    this.syncCanvasSize(rowsToDraw);
    this.ctx.putImageData(image, 0, 0);
  }

  private normalize(value: number): number {
    const clamped = Number.isFinite(value) ? Math.max(value, MAG_EPSILON) : MAG_EPSILON;
    const logValue = Math.log10(clamped);
    const span = this.maxLog - this.minLog;
    if (!Number.isFinite(span) || span <= MAG_EPSILON) {
      return 0;
    }
    return Math.min(1, Math.max(0, (logValue - this.minLog) / span));
  }

  private updateMagnitudeRange(row: Float32Array): void {
    let localMin = Number.POSITIVE_INFINITY;
    let localMax = Number.NEGATIVE_INFINITY;

    for (let i = 0; i < row.length; i++) {
      const value = row[i];
      if (!Number.isFinite(value)) {
        continue;
      }
      if (value < localMin) {
        localMin = value;
      }
      if (value > localMax) {
        localMax = value;
      }
    }

    if (!Number.isFinite(localMin)) {
      localMin = MAG_EPSILON;
    }
    if (!Number.isFinite(localMax) || localMax <= 0) {
      localMax = MAG_EPSILON;
    }

    if (localMin < this.minMagnitude) {
      this.minMagnitude = Math.max(localMin, MAG_EPSILON);
    } else if (this.minMagnitude === Number.POSITIVE_INFINITY) {
      this.minMagnitude = Math.max(localMin, MAG_EPSILON);
    }

    if (localMax > this.maxMagnitude) {
      this.maxMagnitude = Math.max(localMax, MAG_EPSILON);
    } else if (this.maxMagnitude <= 0) {
      this.maxMagnitude = Math.max(localMax, MAG_EPSILON);
    }

    const safeMin = Math.max(this.minMagnitude, MAG_EPSILON);
    const safeMax = Math.max(this.maxMagnitude, safeMin + MAG_EPSILON);
    this.minLog = Math.log10(safeMin);
    this.maxLog = Math.log10(safeMax);
  }

  private buildPalette(
    stops: ReadonlyArray<{ stop: number; color: [number, number, number] }>,
  ): Uint8ClampedArray {
    const palette = new Uint8ClampedArray(256 * 3);

    for (let i = 0; i < 256; i++) {
      const t = i / 255;
      const [r, g, b] = this.interpolateStops(stops, t);
      const offset = i * 3;
      palette[offset] = r;
      palette[offset + 1] = g;
      palette[offset + 2] = b;
    }

    return palette;
  }

  private interpolateStops(
    stops: ReadonlyArray<{ stop: number; color: [number, number, number] }>,
    t: number,
  ): [number, number, number] {
    if (stops.length === 0) {
      return [0, 0, 0];
    }

    if (t <= stops[0].stop) {
      return stops[0].color;
    }

    for (let i = 1; i < stops.length; i++) {
      const current = stops[i];
      const previous = stops[i - 1];
      if (t <= current.stop) {
        const span = Math.max(current.stop - previous.stop, MAG_EPSILON);
        const ratio = Math.min(Math.max((t - previous.stop) / span, 0), 1);
        return [
          Math.round(previous.color[0] + (current.color[0] - previous.color[0]) * ratio),
          Math.round(previous.color[1] + (current.color[1] - previous.color[1]) * ratio),
          Math.round(previous.color[2] + (current.color[2] - previous.color[2]) * ratio),
        ];
      }
    }

    return stops[stops.length - 1].color;
  }

  private clearCanvas(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private readonly handleWorkerMessage = (event: MessageEvent): void => {
    const payload = event.data;
    if (payload && payload.error) {
      console.error('fft.worker error:', payload.error);
      return;
    }

    if (payload && payload.mags) {
      const mags =
        payload.mags instanceof Float32Array ? payload.mags : new Float32Array(payload.mags);
      this.pushRow(mags);
    }
  };

  private readonly handleWorkerError = (event: ErrorEvent): void => {
    console.error('fft.worker encountered an error event:', event.message);
  };
  private createRing(size: number): RingBufferSlot[] {
    return new Array<RingBufferSlot>(size).fill(null);
  }
}
