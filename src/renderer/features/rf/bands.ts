export const RF_BANDS = {
  airband: { label: 'Airband', centerHz: 127_500_000, sampleRate: 2_048_000, spanHz: 2_048_000 },
  marine: { label: 'Marine', centerHz: 156_800_000, sampleRate: 2_048_000, spanHz: 2_048_000 },
  gmrs: { label: 'GMRS', centerHz: 462_625_000, sampleRate: 2_400_000, spanHz: 2_400_000 },
  frs: { label: 'FRS', centerHz: 467_562_500, sampleRate: 2_400_000, spanHz: 2_400_000 },
  '2m_amateur': {
    label: '2m Amateur',
    centerHz: 146_000_000,
    sampleRate: 2_048_000,
    spanHz: 2_048_000,
  },
  '70cm_amateur': {
    label: '70cm Amateur',
    centerHz: 435_000_000,
    sampleRate: 2_400_000,
    spanHz: 2_400_000,
  },
} as const;

export type RfBandKey = keyof typeof RF_BANDS;

export const RF_BAND_OPTIONS: Array<{ key: RfBandKey; label: string }> = Object.entries(
  RF_BANDS,
).map(([key, value]) => ({
  key: key as RfBandKey,
  label: value.label,
}));
