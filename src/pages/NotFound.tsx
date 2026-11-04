import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center bg-background px-4">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-lg text-muted-foreground sm:text-xl">¡Ups! Página no encontrada</p>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-5 py-2.5 font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
