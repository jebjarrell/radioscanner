import { SignalDatabase } from '../storage/signalDb.js';
import { TypedEventEmitter } from '../utils/typedEventEmitter.js';

import { PsdEngine, type SpectrumFrame } from './psdEngine.js';
import { RtlTcpClient, type RtlTcpOptions } from './rtlTcpClient.js';

export type ScanParams = {
  band?: string;
  centerHz?: number;
  sampleRate?: number;
  gain?: number | 'auto';
  spanHz?: number;
};

type RfControllerEvents = {
  spectrum: (frame: SpectrumFrame & { peaks: Array<{ frequency: number; power: number }> }) => void;
  error: (err: Error) => void;
  disconnect: () => void;
};

export class RfController extends TypedEventEmitter<RfControllerEvents> {
  private rtl: RtlTcpClient | null = null;
  private psd: PsdEngine | null = null;
  private current: ScanParams | null = null;

  constructor(private readonly signalDb: SignalDatabase) {
    super();
  }

  isRunning(): boolean {
    return Boolean(this.rtl);
  }

  async start(params: ScanParams): Promise<void> {
    await this.stop();
    this.current = params;
    const centerHz = params.centerHz ?? 118_000_000;
    const sampleRate = params.sampleRate ?? 2_048_000;

    const rtlOptions: RtlTcpOptions = {
      centerHz,
      sampleRate,
      gain: params.gain ?? 'auto',
    };

    this.rtl = new RtlTcpClient(rtlOptions);
    this.psd = new PsdEngine({
      fftSize: 1_024,
      frameRateHz: 5,
      sampleRate,
      avgFrames: 2,
    });

    this.rtl.on('iq', (buffer) => {
      if (!this.psd) {
        return;
      }
      const iq = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.length);
      this.psd.pushIq(iq, centerHz);
    });
    this.rtl.on('error', (err) => this.emit('error', err));
    this.rtl.on('disconnect', () => this.emit('disconnect'));

    this.psd.on('spectrum', (frame) => {
      const peaks = this.pickPeaks(frame);
      const ts = frame.ts;
      for (const peak of peaks) {
        this.signalDb.insertPeak(ts, peak.frequency / 1_000_000, peak.power, frame.binSizeHz);
      }
      this.emit('spectrum', { ...frame, peaks });
    });

    await this.rtl.start();
  }

  async stop(): Promise<void> {
    if (this.rtl) {
      this.rtl.removeAllListeners();
      this.rtl.stop();
      this.rtl = null;
    }
    if (this.psd) {
      this.psd.removeAllListeners();
      this.psd = null;
    }
    this.current = null;
  }

  private pickPeaks(frame: SpectrumFrame): Array<{ frequency: number; power: number }> {
    const peaks: Array<{ frequency: number; power: number }> = [];
    const { bins, binSizeHz, startHz } = frame;
    for (let i = 1; i < bins.length - 1; i++) {
      const power = bins[i];
      if (power <= -30) {
        continue;
      }
      if (power > bins[i - 1] && power > bins[i + 1]) {
        peaks.push({
          frequency: startHz + i * binSizeHz,
          power,
        });
      }
    }
    peaks.sort((a, b) => b.power - a.power);
    return peaks.slice(0, 10);
  }
}
