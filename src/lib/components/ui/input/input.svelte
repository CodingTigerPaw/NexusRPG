<script lang="ts">
  import { cn } from '$lib/utils';
  import type { HTMLInputAttributes } from 'svelte/elements';

  type Props = Omit<HTMLInputAttributes, 'value'> & {
    value?: HTMLInputAttributes['value'];
  };

  let {
    class: className,
    type = 'text',
    value = $bindable<HTMLInputAttributes['value']>(),
    ...restProps
  }: Props = $props();
</script>

<input
  class={cn(
    'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
    className
  )}
  {type}
  bind:value
  {...restProps}
/>
