import { Capacitor } from '@capacitor/core';
import { REVENUECAT_CONFIG, RC_PRODUCTS } from './revenuecat';

// Re-export from revenuecat for backward compatibility
export { REVENUECAT_CONFIG, RC_PRODUCTS };

// Legacy product IDs (kept for reference, RevenueCat handles mapping)
export const IAP_PRODUCTS = {
  PREMIUM_MONTHLY: 'com.atlasoon.anacan.premium.monthly',
  PREMIUM_YEARLY: 'com.atlasoon.anacan.premium.yearly',
} as const;

export const IAP_PLANS = {
  MONTHLY_PLAN: 'monthly-plan',
  YEARLY_PLAN: 'yearly-plan',
} as const;

export const APP_CONFIG = {
  APP_ID: 'com.atlasoon.anacan',
  APP_NAME: 'Anacan',
} as const;

export interface IAPProduct {
  productId: string;
  title: string;
  description: string;
  price: string;
  priceAmount: number;
  currency: string;
}

export interface IAPTransaction {
  transactionId: string;
  productId: string;
  purchaseToken?: string;
  receipt?: string;
  purchaseTime: number;
}

export const isNativePlatform = (): boolean => Capacitor.isNativePlatform();

export const getPlatform = (): 'ios' | 'android' | 'web' => {
  const platform = Capacitor.getPlatform();
  if (platform === 'ios') return 'ios';
  if (platform === 'android') return 'android';
  return 'web';
};
