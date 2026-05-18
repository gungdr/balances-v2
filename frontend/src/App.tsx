import { useQuery } from '@tanstack/react-query'

type HealthzResponse = {
  ok: boolean
  db_time: string
}

async function fetchHealthz(): Promise<HealthzResponse> {
  const res = await fetch('/healthz')
  if (!res.ok) {
    throw new Error(`healthz returned ${res.status}`)
  }
  return res.json()
}

function App() {
  const { data, error, isPending } = useQuery({
    queryKey: ['healthz'],
    queryFn: fetchHealthz,
  })

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-8">
      <div className="max-w-md w-full bg-white rounded-lg shadow p-8 space-y-4">
        <h1 className="text-2xl font-semibold text-slate-900">balances-v2</h1>
        <p className="text-sm text-slate-500">walking skeleton</p>

        <div className="border-t border-slate-200 pt-4 space-y-2">
          <h2 className="text-sm font-medium text-slate-700">Backend health</h2>

          {isPending && <p className="text-sm text-slate-500">checking…</p>}

          {error && (
            <p className="text-sm text-red-600">
              error: {error instanceof Error ? error.message : String(error)}
            </p>
          )}

          {data && (
            <div className="text-sm space-y-1">
              <p className="text-emerald-700">ok: {String(data.ok)}</p>
              <p className="text-slate-600">db time: {data.db_time}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
