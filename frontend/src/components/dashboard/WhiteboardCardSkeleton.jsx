import Skeleton from "../ui/Skeleton";

export default function WhiteboardCardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <Skeleton className="mb-3 h-24 w-full rounded-xl" />
      <Skeleton className="mb-2 h-4 w-2/3" />
      <Skeleton className="h-3 w-1/3" />
    </div>
  );
}
