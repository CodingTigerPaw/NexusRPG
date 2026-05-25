<script lang="ts">
  import { cn } from '$lib/utils';

  type SpinnerSize = 'sm' | 'md' | 'lg';

  type Props = {
    size?: SpinnerSize;
    label?: string;
    class?: string;
  };

  let { size = 'md', label = 'Ładowanie...', class: className = '' }: Props = $props();

  const sizeClass: Record<SpinnerSize, string> = {
    sm: 'h-4 w-4 border-2',
    md: 'h-6 w-6 border-2',
    lg: 'h-9 w-9 border-[3px]'
  };
</script>

<span
  class={cn(
    'inline-block animate-spin rounded-full border-current border-r-transparent text-primary motion-reduce:animate-none',
    sizeClass[size],
    className
  )}
  role="status"
  aria-label={label}
>
  <span class="sr-only">{label}</span>
</span>
