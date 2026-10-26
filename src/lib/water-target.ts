// Daily water goal (glasses) per life stage. Shared by WaterWidget and the home day plan.
const WATER_GLASSES = { bump: 10, mommy: 12, flow: 8 } as const;

export function waterTarget(stage?: string | null): number {
  return WATER_GLASSES[(stage || 'flow') as keyof typeof WATER_GLASSES] || 8;
}
