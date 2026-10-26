export interface CustomerIoConfig {
  region: 'EU';
  environment: 'sandbox' | 'production';
}

/** Each build contains one selected mobile source, never both environments. */
export function readCustomerIoConfig(env: Record<string, unknown>): CustomerIoConfig | null {
  if (env.VITE_CUSTOMERIO_ENABLED !== 'true') return null;
  const environment = env.VITE_CUSTOMERIO_ENVIRONMENT;
  if (!['sandbox', 'production'].includes(String(environment)) || env.VITE_CUSTOMERIO_REGION !== 'EU') return null;
  return { region: 'EU', environment: environment as CustomerIoConfig['environment'] };
}
