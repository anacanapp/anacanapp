export type CustomerIoProperties = Record<string, string | number | boolean>;

export interface CustomerIoDataInPlugin {
  initialize(options: { region: 'EU'; environment: 'sandbox' | 'production' }): Promise<void>;
  identify(options: { userId: string; traits: CustomerIoProperties }): Promise<void>;
  track(options: { name: string; properties: CustomerIoProperties }): Promise<void>;
  screen(options: { title: string; properties: CustomerIoProperties }): Promise<void>;
  reset(): Promise<void>;
}

export const CustomerIoDataIn: CustomerIoDataInPlugin;
