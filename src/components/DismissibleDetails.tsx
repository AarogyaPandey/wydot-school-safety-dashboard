import { useEffect, useRef, type ComponentProps } from 'react';

/** Native disclosure with pointer, focus, and Escape dismissal. */
export function DismissibleDetails(props: ComponentProps<'details'>) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const closeOutside = (event: Event) => {
      if (ref.current?.open && !ref.current.contains(event.target as Node)) ref.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && ref.current?.open) {
        event.preventDefault(); event.stopPropagation();
        ref.current.open = false; ref.current.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('focusin', closeOutside);
    ref.current?.addEventListener('keydown', escape);
    const element = ref.current;
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('focusin', closeOutside);
      element?.removeEventListener('keydown', escape);
    };
  }, []);
  return <details {...props} ref={ref} />;
}
