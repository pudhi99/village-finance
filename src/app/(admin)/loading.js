import { PageHeaderSkeleton, MetricCardsSkeleton, TableSkeleton } from '@/components/ui/Skeleton';

export default function AdminLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <PageHeaderSkeleton />
      <MetricCardsSkeleton count={4} />
      <TableSkeleton rows={5} cols={5} />
    </div>
  );
}
