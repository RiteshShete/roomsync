import { copy } from '@/copy';

/** Shown instead of the app when the Supabase settings are missing or wrong. Never prints key values. */
export function EnvMissingScreen({ missing, secretKey }: { missing: string[]; secretKey: boolean }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-5 py-10">
      <h1 className="text-2xl font-extrabold text-ink">{copy.env.title}</h1>
      <p role="alert" className="text-base text-ink2">
        {secretKey ? copy.env.secretKey : copy.env.body}
      </p>
      {missing.length > 0 ? (
        <ul className="list-disc pl-6 text-base text-ink">
          {missing.map((name) => (
            <li key={name}>
              <code className="font-mono text-sm">{name}</code>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-base text-ink2">{copy.env.fix}</p>
    </main>
  );
}
