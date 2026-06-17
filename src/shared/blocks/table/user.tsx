import { Link } from '@/shared/blocks/common/navigation';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/shared/components/ui/avatar';
import { cn } from '@/shared/lib/utils';

export type TableUserValue = {
  email: string | null;
  image: string | null;
  name: string | null;
};

export function User({
  value,
  placeholder,
  metadata: _metadata,
  className,
}: {
  value: TableUserValue;
  placeholder?: string;
  metadata?: Record<string, unknown>;
  className?: string;
}) {
  if (!value) {
    if (placeholder) {
      return <div className={className}>{placeholder}</div>;
    }

    return null;
  }

  return (
    <Link
      href={`/admin/users?email=${value.email}`}
      target="_blank"
      rel="noopener noreferrer"
      className={cn('flex items-center gap-2', className)}
    >
      <Avatar className={className}>
        <AvatarImage src={value.image || ''} alt={value.name ?? undefined} />
        <AvatarFallback>{value.name?.charAt(0) || 'U'}</AvatarFallback>
      </Avatar>
      <div className="flex flex-col">{value.name}</div>
    </Link>
  );
}
