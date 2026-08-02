export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center bg-background text-foreground">
      <div className="max-w-md space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">blr.life</h1>
        <p className="text-xl font-medium text-gray-600 dark:text-gray-400">
          Bengaluru, made easier.
        </p>
        <div className="pt-4 p-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
          <p className="text-sm font-mono text-gray-700 dark:text-gray-300">
            Application foundation is running.
          </p>
        </div>
      </div>
    </main>
  );
}
