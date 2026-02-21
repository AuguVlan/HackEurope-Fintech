import React from 'react';
import { cn } from '../lib/cn';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  glass?: boolean;
}

export const Card: React.FC<CardProps> = ({ className, glass = true, ...props }) => (
  <div
    className={cn(
      glass ? 'glass' : 'bg-card',
      'rounded-2xl p-6 border border-border/20',
      className
    )}
    {...props}
  />
);

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}) => {
  const variantClass = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    ghost: 'btn-ghost',
  }[variant];

  const sizeClass = {
    sm: 'px-3 py-1 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg',
  }[size];

  return (
    <button
      className={cn(variantClass, sizeClass, 'rounded-xl font-medium transition-opacity', className)}
      {...props}
    />
  );
};

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'success' | 'warning' | 'danger' | 'info';
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'info', className, children, ...props }) => {
  const variantClass = {
    success: 'badge-success',
    warning: 'badge-warning',
    danger: 'badge-danger',
    info: 'badge-info',
  }[variant];

  return (
    <div className={cn('badge', variantClass, className)} {...props}>
      {children}
    </div>
  );
};

interface StatProps {
  label: string;
  value: string | number;
  change?: number;
  icon?: React.ReactNode;
}

export const Stat: React.FC<StatProps> = ({ label, value, change, icon }) => (
  <div className="flex flex-col">
    <div className="flex items-center gap-2 mb-1">
      {icon}
      <span className="text-muted-foreground text-sm">{label}</span>
    </div>
    <div className="flex items-baseline gap-2">
      <span className="text-2xl font-semibold text-foreground">{value}</span>
      {change !== undefined && (
        <span className={cn('text-sm font-medium', change >= 0 ? 'text-secondary' : 'text-destructive')}>
          {change > 0 ? '+' : ''}{change.toFixed(1)}%
        </span>
      )}
    </div>
  </div>
);

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  count?: number;
}

export const Skeleton: React.FC<SkeletonProps> = ({ count = 1, className, ...props }) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className={cn(
          'animate-pulse rounded-lg bg-muted/20',
          className
        )}
        {...props}
      />
    ))}
  </>
);

interface ProgressProps {
  value: number;
  max?: number;
  label?: string;
  className?: string;
}

export const Progress: React.FC<ProgressProps> = ({ value, max = 100, label, className }) => {
  const percentage = Math.min((value / max) * 100, 100);
  const color = percentage < 30 ? 'bg-destructive' : percentage < 70 ? 'bg-yellow-500' : 'bg-secondary';

  return (
    <div className={className}>
      {label && <div className="text-sm font-medium mb-2">{label}</div>}
      <div className="w-full h-2 bg-muted/20 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-300', color)}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {label && <div className="text-xs text-muted-foreground mt-1">{percentage.toFixed(0)}%</div>}
    </div>
  );
};
