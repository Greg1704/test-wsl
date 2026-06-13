import { Skeleton } from "@/components/ui/skeleton";

// loading.tsx: Next.js lo muestra mientras el Server Component de page.tsx
// resuelve sus datos (Suspense bajo el capó).
export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8">
      <div className="grid gap-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-80" />
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  );
}
