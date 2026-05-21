import { useEffect, useState } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import useNewsStore from '@/stores/newsStore'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/PageHeader'

function formatPublished(iso) {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

function NewsCard({ item }) {
  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col gap-2 rounded-lg border border-gray-800 bg-gray-800/30 p-3 hover:bg-gray-800/60 transition-colors"
    >
      {item.image && (
        <img
          src={item.image}
          alt=""
          className="w-full h-36 object-cover rounded"
          onError={(e) => { e.target.style.display = 'none' }}
        />
      )}
      <p className="text-sm font-medium text-gray-200 line-clamp-3 group-hover:text-white leading-snug">
        {item.title}
      </p>
      {item.summary && (
        <p className="text-xs text-gray-500 line-clamp-3 leading-relaxed">{item.summary}</p>
      )}
      <div className="flex items-center justify-between mt-auto pt-1">
        <span className="text-xs text-gray-600">{formatPublished(item.published)}</span>
        <ExternalLink size={12} className="text-gray-600 group-hover:text-blue-400" />
      </div>
    </a>
  )
}

function FeedColumn({ feed, onRefresh, isRefreshing }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-100">{feed.label}</h2>
          {feed.category && (
            <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded mt-0.5 inline-block">
              {feed.category}
            </span>
          )}
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-gray-500 hover:text-blue-400"
          onClick={() => onRefresh(feed.id)}
          disabled={isRefreshing}
        >
          <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
        </Button>
      </div>
      <div className="space-y-2">
        {feed.items.map((item, i) => (
          <NewsCard key={i} item={item} />
        ))}
        {feed.items.length === 0 && (
          <p className="text-xs text-gray-600 text-center py-6">Sem itens.</p>
        )}
      </div>
    </div>
  )
}

export default function NewsPage() {
  const { feeds, isLoading, fetchNews, refreshFeed } = useNewsStore()
  const [refreshingId, setRefreshingId] = useState(null)

  useEffect(() => {
    fetchNews()
  }, [fetchNews])

  const handleRefresh = async (id) => {
    setRefreshingId(id)
    try {
      await refreshFeed(id)
    } finally {
      setRefreshingId(null)
    }
  }

  if (isLoading && feeds.length === 0) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-sm text-gray-500 animate-pulse">Carregando notícias…</p>
      </div>
    )
  }

  if (feeds.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500 text-sm">
        Nenhum feed ativo. Configure feeds em{' '}
        <a href="/settings" className="text-blue-400 hover:underline">Ajustes</a>.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader icon="ti-news" title="Notícias" />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 items-start">
        {feeds.map((feed) => (
          <FeedColumn
            key={feed.id}
            feed={feed}
            onRefresh={handleRefresh}
            isRefreshing={refreshingId === feed.id}
          />
        ))}
      </div>
    </div>
  )
}
