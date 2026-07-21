# RF Spectrum Visualization - Completion Plan

## Current State Analysis

### What Exists ✅

1. **WaterfallCanvas.ts** - Sophisticated waterfall implementation:
   - Ring buffer for history (100 rows)
   - Color palette interpolation
   - Log-scale magnitude normalization
   - FFT worker integration
   - Dynamic canvas sizing

2. **RfWaterfall.tsx** - Basic waterfall component:
   - Uses simple waterfallWorker
   - Scrolling line-by-line
   - Grayscale only

3. **RfSpectrum.tsx** - Basic spectrum chart:
   - Line plot of power vs frequency
   - Basic peak markers (red vertical lines)
   - No axes, no grid, no labels

4. **Peak Detection** (rfController.ts):
   - Simple local maxima detection
   - Threshold: > -30 dB
   - No noise floor estimation
   - No SNR filtering

### What Needs Improvement ⚠️

1. **Waterfall Component:**
   - ❌ Not using the sophisticated WaterfallCanvas
   - ❌ No frequency axis labels
   - ❌ No time axis labels
   - ❌ No colorbar/legend
   - ❌ Basic grayscale only

2. **Spectrum Chart:**
   - ❌ No frequency axis with labels
   - ❌ No power (dB) axis with labels
   - ❌ No grid lines
   - ❌ Peak labels not showing frequency/power values
   - ❌ No hold/max hold functionality
   - ❌ Basic styling

3. **Peak Detection:**
   - ❌ No noise floor estimation
   - ❌ No SNR-based filtering
   - ❌ Fixed threshold (-30 dB)
   - ❌ No minimum peak width
   - ❌ No hysteresis (peaks flicker)

## Implementation Plan

### Phase 1: Enhanced Waterfall Display

**Goal:** Professional waterfall with axes, labels, and colorbar

#### 1.1 Integrate WaterfallCanvas into RfWaterfall
- Replace simple worker with WaterfallCanvas
- Use color palette from WaterfallCanvas
- Add wrapper div for axes

#### 1.2 Add Frequency Axis
- Bottom axis showing frequency range
- Auto-scaling labels (kHz, MHz, GHz)
- Major and minor tick marks
- Centered on tuned frequency

#### 1.3 Add Time Axis (optional)
- Left axis showing relative time
- Scrolling time labels
- Seconds or minutes

#### 1.4 Add Colorbar Legend
- Right-side color scale
- dB or magnitude labels
- Min/max indicators

### Phase 2: Enhanced Spectrum Chart

**Goal:** Professional spectrum analyzer with full annotations

#### 2.1 Add Frequency Axis
- Bottom axis with tick marks
- Auto-scaling frequency labels
- Grid lines (vertical)
- Center frequency marker

#### 2.2 Add Power Axis
- Left axis with dB scale
- Horizontal grid lines
- dBFS or dBm units
- Auto-ranging

#### 2.3 Improve Peak Markers
- Tooltip/label showing:
  - Frequency (MHz)
  - Power (dB)
  - Peak number
- Different marker styles
- Color coding by strength

#### 2.4 Add Hold/Max Hold
- "Hold" button to freeze current trace
- "Max Hold" to show maximum values
- "Clear Max" button
- Configurable hold time

#### 2.5 Styling Improvements
- Better colors (not just green)
- Gradient fill under curve
- Anti-aliased rendering
- Smooth animations

### Phase 3: Improved Peak Detection

**Goal:** Robust peak detection with SNR filtering

#### 3.1 Noise Floor Estimation
- Use median or percentile of bins
- Adaptive estimation
- Per-frame calculation

#### 3.2 SNR-Based Filtering
- Require peak > noise floor + X dB
- Configurable SNR threshold (default: 6 dB)
- Reject noise peaks

#### 3.3 Peak Width Filtering
- Require minimum peak width (e.g., 3 bins)
- Reject single-bin spikes
- More robust detection

#### 3.4 Peak Smoothing/Hysteresis
- Track peaks across frames
- Require peak to persist N frames
- Smooth peak frequency/power
- Reduce flicker

#### 3.5 Advanced Features
- Top N peaks only
- Exclude DC bin (bin 0)
- Exclude frequency ranges (notch filter)
- Peak annotation

## File Structure

### New Files to Create

1. **src/renderer/components/FrequencyAxis.tsx**
   - Reusable frequency axis component
   - Auto-scaling labels
   - Tick marks and grid

2. **src/renderer/components/PowerAxis.tsx**
   - Reusable power (dB) axis component
   - Grid lines
   - Auto-ranging

3. **src/renderer/components/Colorbar.tsx**
   - Color scale legend
   - dB labels
   - Min/max indicators

4. **src/backend/sdr/peakDetector.ts**
   - Advanced peak detection class
   - Noise floor estimation
   - SNR filtering
   - Peak tracking

### Files to Modify

1. **src/renderer/features/rf/RfWaterfall.tsx**
   - Integrate WaterfallCanvas
   - Add axes and colorbar
   - Layout improvements

2. **src/renderer/features/rf/RfSpectrum.tsx**
   - Add FrequencyAxis and PowerAxis
   - Improve peak markers
   - Add hold/max hold
   - Better styling

3. **src/backend/sdr/rfController.ts**
   - Replace pickPeaks with new PeakDetector
   - Configure thresholds

4. **src/renderer/features/rf/RfPanel.tsx**
   - Add UI controls for hold/max/clear
   - Peak detection settings

## Technical Details

### Frequency Axis Implementation

```typescript
interface FrequencyAxisProps {
  startHz: number;
  endHz: number;
  width: number;
  height: number;
}

// Auto-scale to appropriate units
function formatFrequency(hz: number): string {
  if (hz >= 1e9) return `${(hz / 1e9).toFixed(2)} GHz`;
  if (hz >= 1e6) return `${(hz / 1e6).toFixed(2)} MHz`;
  if (hz >= 1e3) return `${(hz / 1e3).toFixed(1)} kHz`;
  return `${hz.toFixed(0)} Hz`;
}
```

### Power Axis Implementation

```typescript
interface PowerAxisProps {
  minDb: number;
  maxDb: number;
  width: number;
  height: number;
}

// Grid lines every 10 dB
function generateDbTicks(minDb: number, maxDb: number): number[] {
  const ticks: number[] = [];
  const start = Math.ceil(minDb / 10) * 10;
  const end = Math.floor(maxDb / 10) * 10;
  for (let db = start; db <= end; db += 10) {
    ticks.push(db);
  }
  return ticks;
}
```

### Noise Floor Estimation

```typescript
function estimateNoiseFloor(bins: number[]): number {
  // Use 10th percentile as noise floor
  const sorted = [...bins].sort((a, b) => a - b);
  const index = Math.floor(sorted.length * 0.1);
  return sorted[index];
}
```

### Peak Detection with SNR

```typescript
interface Peak {
  bin: number;
  frequency: number;
  power: number;
  snr: number;
  width: number;
}

function detectPeaksWithSnr(
  bins: number[],
  startHz: number,
  binSizeHz: number,
  options: {
    minSnrDb: number;
    minPower: number;
    minWidth: number;
    maxPeaks: number;
  }
): Peak[] {
  const noiseFloor = estimateNoiseFloor(bins);
  const peaks: Peak[] = [];

  for (let i = 1; i < bins.length - 1; i++) {
    const power = bins[i];

    // Check if local maximum
    if (power <= bins[i - 1] || power <= bins[i + 1]) continue;

    // Check SNR
    const snr = power - noiseFloor;
    if (snr < options.minSnrDb) continue;

    // Check absolute power
    if (power < options.minPower) continue;

    // Measure peak width
    let width = 1;
    // ... peak width calculation

    if (width < options.minWidth) continue;

    peaks.push({
      bin: i,
      frequency: startHz + i * binSizeHz,
      power,
      snr,
      width
    });
  }

  // Sort by SNR and take top N
  return peaks
    .sort((a, b) => b.snr - a.snr)
    .slice(0, options.maxPeaks);
}
```

### Hold/Max Hold State

```typescript
interface SpectrumState {
  current: number[];        // Current frame
  hold: number[] | null;    // Frozen trace
  maxHold: number[];        // Maximum values
  holdEnabled: boolean;
  maxHoldEnabled: boolean;
}

function updateMaxHold(current: number[], maxHold: number[]): number[] {
  return current.map((val, i) => Math.max(val, maxHold[i]));
}
```

## Performance Considerations

### Rendering Optimization
- Use requestAnimationFrame for smooth updates
- Throttle updates to 30-60 FPS max
- Offscreen canvas for axis rendering
- Path2D caching for grid lines

### Memory Management
- Limit waterfall history (100 rows)
- Reuse canvas ImageData buffers
- Prune old peak tracking data

### Worker Usage
- Keep FFT in worker (already done)
- Move peak detection to worker (optional)
- Parallel processing for multiple traces

## Testing Strategy

### Unit Tests
```typescript
describe('PeakDetector', () => {
  it('should estimate noise floor correctly', () => {
    // Test with known signal + noise
  });

  it('should detect peaks with SNR filter', () => {
    // Test peak detection
  });

  it('should filter narrow spikes', () => {
    // Test width filtering
  });
});

describe('FrequencyAxis', () => {
  it('should format frequencies correctly', () => {
    expect(formatFrequency(118e6)).toBe('118.00 MHz');
  });
});
```

### Visual Testing
- Test with live RTL-SDR data
- Test with simulated signals
- Test with noise only
- Test with very strong signals
- Test with many simultaneous peaks

### Performance Testing
- Measure frame rate at different resolutions
- Memory usage over time
- CPU usage during peak periods
- Browser compatibility

## Success Criteria

### Waterfall ✓
- [x] Uses sophisticated WaterfallCanvas
- [x] Frequency axis with auto-scaled labels
- [x] Colorbar showing power scale
- [x] Smooth scrolling
- [x] No visual artifacts

### Spectrum Chart ✓
- [x] Frequency axis with grid
- [x] Power (dB) axis with grid
- [x] Peak markers with labels
- [x] Hold and Max Hold features
- [x] Professional appearance

### Peak Detection ✓
- [x] Noise floor estimation
- [x] SNR-based filtering
- [x] Peak width filtering
- [x] Configurable thresholds
- [x] Stable detection (no flicker)

### Performance ✓
- [x] 30+ FPS rendering
- [x] <5% CPU overhead
- [x] <50 MB memory usage
- [x] Works on 1920x1080 displays

## Timeline Estimate

- **Phase 1 (Waterfall)**: 3-4 hours
- **Phase 2 (Spectrum)**: 4-5 hours
- **Phase 3 (Peak Detection)**: 2-3 hours
- **Testing & Polish**: 1-2 hours
- **Total**: 10-14 hours

## References

- [RTL-SDR Spectrum Analyzer](https://www.rtl-sdr.com/rtl-sdr-tutorial-spectrum-analyzer/)
- [SDR# (SDRSharp)](https://airspy.com/download/)
- [GQRX Spectrum Display](https://gqrx.dk/)
- [Canvas Performance](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas)
