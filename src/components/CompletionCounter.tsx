interface CompletionCounterProps {
  owned: number;
  total?: number;
  className?: string;
}

export default function CompletionCounter({ owned, total = 20, className = '' }: CompletionCounterProps) {
  const isComplete = owned >= total;
  return (
    <div className={`absolute bottom-1 left-1 z-20 bg-gray-900/80 rounded px-1 ${className}`}>
      <span className={`text-[10px] font-mono font-bold ${isComplete ? 'text-yellow-400' : 'text-gray-300'}`}>
        {owned}/{total}
      </span>
    </div>
  );
}