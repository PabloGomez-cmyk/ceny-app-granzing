export interface StatusBadgeConfig {
  label: string;
  color: string;
  dot: string;
}

export default function StatusBadge({ config }: { config: StatusBadgeConfig }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${config.color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}
