// frontend/src/components/Skeleton.jsx
//
// Uso:
//   <Skeleton className="h-6 w-32" />        // bloco simples
//   <SkeletonCard />                          // card padrão (ex: clã, item)
//   <SkeletonList n={5} />                   // lista de cards
//   <SkeletonText lines={3} />               // parágrafo

export function Skeleton({ className = '', rounded = 'rounded-md' }) {
  return (
    <div className={`bg-zinc-800/70 ${rounded} skeleton-shimmer ${className}`} />
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-zinc-900 border border-white/5 rounded-xl p-4 flex items-center gap-3">
      <Skeleton className="w-12 h-12" rounded="rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-3/4" />
      </div>
      <Skeleton className="h-8 w-16" rounded="rounded-lg" />
    </div>
  );
}

export function SkeletonList({ n = 4 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: n }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}

export function SkeletonText({ lines = 3 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-3 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  );
}
