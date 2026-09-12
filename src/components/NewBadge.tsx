interface NewBadgeProps {
  variant: 'card' | 'variant';
  className?: string;
}

export default function NewBadge({ variant, className = '' }: NewBadgeProps) {
  if (variant === 'card') {
    return (
      <div className={`absolute -top-1 -left-1 z-30 bg-red-500 text-white text-[10px] font-bold px-0.5 py-4 ml-2 rounded shadow-lg ${className}`}>
        NEW!
      </div>
    );
  }
  return (
    <div className={`absolute -top-1 -left-1 z-30 bg-red-700 text-white text-[8px] font-bold px-1 py-0.5 ml-2 rounded ${className}`}>
      new variant
    </div>
  );
}