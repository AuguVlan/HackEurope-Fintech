// src/lib/utils.ts

/**
 * Formats a minor currency unit (e.g., cents) into a localized string.
 * Usage: formatCurrency(5000, 'USD') -> "$50.00"
 */
export const formatCurrency = (amountMinor: number, currency: string = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amountMinor / 100);
};

/**
 * Calculates the percentage change between a current and previous value.
 * Returns a signed string (e.g., "+10.5%" or "-5.0%")
 */
export const calculatePercentageChange = (current: number, previous: number): string => {
  if (previous === 0) return current > 0 ? '+100%' : '0%';
  const change = ((current - previous) / previous) * 100;
  return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
};

/**
 * Generates simple coordinates for a sparkline graph based on numeric data.
 * Useful for small trend lines in tables.
 */
export const generateSparklineData = (values: number[], width: number = 100, height: number = 30) => {
  if (values.length < 2) return "";
  
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  
  return values.map((val, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');
};

/**
 * Often used in Tailwind projects for conditional class merging.
 * If your ObligationsPanel uses 'cn', you might need this too:
 */
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a number as USD currency.
 * Handles both minor units (cents) and standard dollars.
 * * @param amount - The value to format
 * @param isMinorUnits - If true, treats 100 as $1.00 (standard for Stripe/Fintech APIs)
 */
export const formatUSD = (amount: number, isMinorUnits: boolean = true): string => {
  const value = isMinorUnits ? amount / 100 : amount;
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

/**
 * Formats a raw number with comma separators.
 * Example: 12500 -> "12,500"
 * @param value - The number to format
 * @param decimals - Number of decimal places (default 0)
 */
export const formatNumber = (value: number, decimals: number = 0): string => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value || 0); // Added || 0 to prevent crashes on undefined
};


/**
 * Returns a human-readable status based on a percentage (0-100)
 */
export const healthStatus = (percentage: number): string => {
  if (percentage >= 80) return 'Healthy';
  if (percentage >= 50) return 'Stable';
  if (percentage >= 20) return 'Warning';
  return 'Critical';
};

/**
 * Returns Tailwind CSS color classes based on health percentage
 */
export const healthStatusClass = (percentage: number): string => {
  if (percentage >= 80) return 'text-green-500 bg-green-500/10';
  if (percentage >= 50) return 'text-blue-500 bg-blue-500/10';
  if (percentage >= 20) return 'text-yellow-500 bg-yellow-500/10';
  return 'text-red-500 bg-red-500/10';
};

/**
 * Formats a timestamp or Date into a readable time string.
 * Supports Unix timestamps (seconds) or Milliseconds.
 */
export const formatTime = (timestamp: number | string | Date): string => {
  const date = typeof timestamp === 'number' && timestamp < 10000000000 
    ? new Date(timestamp * 1000) // Convert Unix seconds to MS
    : new Date(timestamp);

  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
};

/**
 * Bonus: Often useful for feeds to show "3 mins ago"
 */
export const formatRelativeTime = (timestamp: number): string => {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(timestamp * 1000).toLocaleDateString();
};