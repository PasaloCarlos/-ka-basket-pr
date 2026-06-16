export default function AdminLoading() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <div className="size-10 animate-spin rounded-full border-2 border-border border-t-primary motion-reduce:animate-none" />
      <p className="mt-4 font-display text-sm uppercase tracking-[0.3em] text-muted-foreground">
        Cargando…
      </p>
    </main>
  );
}
