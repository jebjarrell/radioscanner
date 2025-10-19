/* 
  fft.worker.js
  Workerized FFT for I/Q -> magnitude spectrum.
  - Expects messages: { iq: ArrayBuffer|Float32Array, fftSize: number, window?: 'hann'|'none', shift?: boolean }
  - iq is interleaved [I0, Q0, I1, Q1, ...]. Only the first fftSize complex samples are used.
  - Replies: { mags: Float32Array, fftSize: number } with mags.buffer transferred.
*/

// Hann window cache
const windowCache = new Map();
function hannWindow(N) {
  if (windowCache.has(N)) return windowCache.get(N);
  const w = new Float32Array(N);
  for (let n = 0; n < N; n++) w[n] = 0.5 * (1 - Math.cos((2*Math.PI*n)/(N-1)));
  windowCache.set(N, w);
  return w;
}

// In-place radix-2 Cooley-Tukey FFT (complex arrays real[] & imag[])
function fftRadix2(re, im) {
  const N = re.length;
  // bit-reversal
  for (let i = 0, j = 0; i < N; i++) {
    if (i < j) {
      const tr = re[i]; re[i] = re[j]; re[j] = tr;
      const ti = im[i]; im[i] = im[j]; im[j] = ti;
    }
    let k = N >> 1;
    while (k && ((j &= ~k), !(j += k))) k >>= 1;
  }
  // butterflies
  for (let len = 2; len <= N; len <<= 1) {
    const ang = -2*Math.PI/len;
    const wlen_r = Math.cos(ang);
    const wlen_i = Math.sin(ang);
    for (let i = 0; i < N; i += len) {
      let wr = 1, wi = 0;
      for (let j = 0; j < (len>>1); j++) {
        const u_r = re[i+j], u_i = im[i+j];
        const v_r = re[i+j+(len>>1)]*wr - im[i+j+(len>>1)]*wi;
        const v_i = re[i+j+(len>>1)]*wi + im[i+j+(len>>1)]*wr;
        re[i+j] = u_r + v_r;
        im[i+j] = u_i + v_i;
        re[i+j+(len>>1)] = u_r - v_r;
        im[i+j+(len>>1)] = u_i - v_i;
        // w *= wlen
        const nxt_wr = wr*wlen_r - wi*wlen_i;
        wi = wr*wlen_i + wi*wlen_r;
        wr = nxt_wr;
      }
    }
  }
}

function shiftFFT(mags) {
  // swap lower/upper halves to center DC
  const N = mags.length;
  const half = N >> 1;
  const out = new Float32Array(N);
  out.set(mags.subarray(half), 0);
  out.set(mags.subarray(0, half), half);
  return out;
}

self.onmessage = (evt) => {
  try {
    const { iq, fftSize, window = 'hann', shift = true } = evt.data || {};
    if (!iq || !fftSize || (fftSize & (fftSize - 1)) !== 0) {
      throw new Error("fft.worker: Provide iq buffer and power-of-two fftSize");
    }
    const iqView = iq instanceof Float32Array ? iq : new Float32Array(iq);
    const N = Math.min(fftSize, (iqView.length/2)|0);
    const re = new Float32Array(fftSize);
    const im = new Float32Array(fftSize);
    const w = window === 'hann' ? hannWindow(N) : null;
    for (let n = 0; n < N; n++) {
      const I = iqView[(n<<1)];
      const Q = iqView[(n<<1)+1];
      if (w) {
        re[n] = I * w[n];
        im[n] = Q * w[n];
      } else {
        re[n] = I;
        im[n] = Q;
      }
    }
    // zero-pad if N < fftSize already default zeros
    fftRadix2(re, im);
    const mags = new Float32Array(fftSize);
    for (let k = 0; k < fftSize; k++) {
      const r = re[k], i = im[k];
      mags[k] = Math.hypot(r, i);
    }
    const out = shift ? shiftFFT(mags) : mags;
    self.postMessage({ mags: out, fftSize }, [out.buffer]);
  } catch (err) {
    self.postMessage({ error: String(err && err.message || err) });
  }
};
