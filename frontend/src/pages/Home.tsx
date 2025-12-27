import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { api } from '@/api/client'
import type { HealthResponse, ItemRead } from '@/api/types'

export default function Home() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [items, setItems] = useState<ItemRead[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const [healthData, itemsData] = await Promise.all([
          api.health.check(),
          api.items.list().catch(() => [] as ItemRead[]),
        ])
        setHealth(healthData)
        setItems(itemsData)
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="flex flex-col items-center justify-center space-y-8">
        <h1 className="text-4xl font-bold tracking-tight">App Template</h1>
        <p className="text-muted-foreground text-lg">
          A full-stack template with FastAPI, React, and MCP integration
        </p>

        <div className="flex gap-4">
          <Button>Get Started</Button>
          <Button variant="outline">Documentation</Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 mt-8 w-full max-w-2xl">
          {/* Backend Status Card */}
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Backend Status</h2>
            {loading ? (
              <p className="text-muted-foreground">Checking...</p>
            ) : health ? (
              <div className="space-y-2">
                <p>
                  <span className="font-medium">Status:</span>{' '}
                  <span className="text-green-600">{health.status}</span>
                </p>
                <p>
                  <span className="font-medium">Service:</span> {health.service}
                </p>
              </div>
            ) : (
              <p className="text-destructive">Unable to connect to backend</p>
            )}
          </div>

          {/* Items Card */}
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Items</h2>
            {loading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : items.length > 0 ? (
              <ul className="space-y-2">
                {items.slice(0, 5).map((item) => (
                  <li key={item.id} className="flex justify-between">
                    <span>{item.name}</span>
                    <span className="text-muted-foreground">
                      ${item.price.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">
                No items yet. Add some via the API!
              </p>
            )}
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid gap-4 md:grid-cols-3 w-full max-w-4xl mt-8">
          <FeatureCard
            title="Type-Safe API"
            description="Models defined once in SQLModel, auto-generated TypeScript types"
          />
          <FeatureCard
            title="MCP Integration"
            description="AI can query database, test API, and validate UI"
          />
          <FeatureCard
            title="Modern Stack"
            description="FastAPI + React + Tailwind + shadcn/ui"
          />
        </div>
      </div>
    </div>
  )
}

function FeatureCard({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1">{description}</p>
    </div>
  )
}
