import type { AssetKind, AssetSpec, DistrictKind } from './model';
import { radiusForMass } from './model';

export const ASSET_CATALOG: readonly AssetSpec[] = [
  { kind: 'investment', requiredMass: 0, value: 4, radius: 6, color: '#b9ef91' },
  { kind: 'gpu', requiredMass: 60, value: 28, radius: radiusForMass(60) * .34, color: '#77c8dd' },
  { kind: 'office', requiredMass: 150, value: 75, radius: radiusForMass(150) * .46, color: '#b4b9d8' },
  { kind: 'server', requiredMass: 420, value: 190, radius: radiusForMass(420) * .38, color: '#74c4b4' },
  { kind: 'data-center', requiredMass: 1500, value: 620, radius: radiusForMass(1500) * .46, color: '#91b6d6' },
  { kind: 'tower', requiredMass: 5200, value: 2000, radius: radiusForMass(5200) * .44, color: '#c0b7d9' },
  { kind: 'campus', requiredMass: 18000, value: 7000, radius: radiusForMass(18000) * .46, color: '#8dc0a5' },
  { kind: 'hq', requiredMass: 60000, value: 25000, radius: radiusForMass(60000) * .46, color: '#d7c797' },
];
export const assetSpec = (kind: AssetKind) => ASSET_CATALOG.find(spec => spec.kind === kind)!;

/** Asset amounts keep pace with an endless company, without a last funding round. */
export function fundingSpec(referenceMass: number, blockSize: number): AssetSpec {
  return { ...ASSET_CATALOG[0], value: Math.max(4, referenceMass * .028), radius: blockSize * .023 };
}
export function resourceSpec(referenceMass: number, blockSize: number, roll: number, district: DistrictKind): AssetSpec {
  let catalog = ASSET_CATALOG.slice(1).filter(spec => spec.requiredMass <= Math.max(180, referenceMass * 3.5));
  const relevant = catalog.filter(spec => spec.requiredMass >= referenceMass * .1);
  if (relevant.length) catalog = relevant;
  if (district === 'tech') catalog = [...catalog, ...catalog.filter(spec => ['gpu', 'server', 'data-center'].includes(spec.kind))];
  const original = catalog[Math.min(catalog.length - 1, Math.floor(roll * catalog.length))];
  const scale = Math.max(1, referenceMass / Math.max(original.requiredMass * 2.4, 1));
  return {
    ...original,
    requiredMass: original.requiredMass * scale,
    value: original.value * scale,
    radius: Math.min(blockSize * .19, radiusForMass(original.requiredMass * scale) * (original.kind === 'gpu' || original.kind === 'server' ? .4 : .5)),
  };
}

export function formatMoney(mass: number): string {
  const value = Number.isFinite(mass) ? Math.max(0, mass) : Number.MAX_VALUE;
  const units = [[1e12, 'Q'], [1e9, 'T'], [1e6, 'B'], [1e3, 'M'], [1, 'K']] as const;
  for (const [divisor, suffix] of units) {
    if (value >= divisor) {
      const amount = value / divisor;
      if (amount >= 1e6) return `$${value.toExponential(1)}K`;
      return `$${Number(amount.toFixed(amount >= 100 ? 0 : amount >= 10 ? 1 : 2))}${suffix}`;
    }
  }
  return `$${Number(value.toFixed(1))}K`;
}
export function formatTime(seconds: number): string {
  const value = Math.max(0, Math.floor(seconds));
  if (value >= 3600) return `${Math.floor(value / 3600)}:${String(Math.floor(value / 60) % 60).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}
