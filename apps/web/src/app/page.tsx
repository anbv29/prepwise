import { KIT_SCHEMA_VERSION } from '@prep-kit/contracts';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl items-center px-6 py-16">
      <section className="space-y-5">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
          Schema version {KIT_SCHEMA_VERSION}
        </p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">AI Interview Prep Kit</h1>
        <p className="max-w-2xl text-lg leading-8 text-slate-600">
          The project foundation is ready. Authentication, research, generation, editing, and
          practice mode will be added in focused implementation steps.
        </p>
      </section>
    </main>
  );
}
