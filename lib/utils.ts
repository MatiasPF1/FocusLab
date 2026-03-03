// Don't erase, is used in components/ui/flow-field-background.tsx that filters out any null, undefined, or false values.
export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}
