'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Package, Layers, AlertTriangle, RefreshCw } from 'lucide-react'

interface Stock {
  id: string
  brickType: string
  openingStock: number
  currentStock: number
  updatedAt: string
}

const enIN = new Intl.NumberFormat('en-IN')

function getStatusConfig(currentStock: number) {
  if (currentStock > 200) {
    return {
      label: 'In Stock',
      className:
        'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
    }
  }
  if (currentStock >= 100) {
    return {
      label: 'Moderate',
      className:
        'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
    }
  }
  return {
    label: 'Low Stock',
    className:
      'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800',
  }
}

function formatUpdatedAt(dateStr: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function StockModule() {
  const [stocks, setStocks] = useState<Stock[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)

  const fetchStocks = useCallback(async () => {
    try {
      const res = await api.getStock()
      const stockData = (res.stocks as Stock[]).sort((a, b) =>
        a.brickType.localeCompare(b.brickType)
      )
      setStocks(stockData)
      setLastRefreshed(new Date())

      const lowCount = stockData.filter((s) => s.currentStock < 100).length
      if (lowCount > 0) {
        toast({
          title: 'Low Stock Warning',
          description: `${lowCount} brick type${lowCount > 1 ? 's' : ''} below minimum threshold (100)`,
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to fetch stock data',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStocks()
  }, [fetchStocks])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchStocks()
    }, 30000)
    return () => clearInterval(interval)
  }, [fetchStocks])

  const totalStock = stocks.reduce((sum, s) => sum + s.currentStock, 0)
  const brickTypes = new Set(stocks.map((s) => s.brickType)).size
  const lowStockItems = stocks.filter((s) => s.currentStock < 100)
  const lowStockCount = lowStockItems.length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
            <Package className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Stock Management</h1>
            <p className="text-sm text-muted-foreground">
              Monitor inventory levels and low stock alerts
            </p>
          </div>
        </div>
        {lastRefreshed && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <RefreshCw className="h-3 w-3" />
            <span>
              Auto-refreshed &middot; Last updated{' '}
              {lastRefreshed.toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </span>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Stock */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Total Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                {enIN.format(totalStock)}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">units across all types</p>
          </CardContent>
        </Card>

        {/* Brick Types */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Layers className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              Brick Types
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                {enIN.format(brickTypes)}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">unique brick varieties</p>
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-bold text-rose-700 dark:text-rose-400">
                {enIN.format(lowStockCount)}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">types below 100 units</p>
          </CardContent>
        </Card>
      </div>

      {/* Stock Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Stock Inventory
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-10 flex-1" />
                  <Skeleton className="h-10 flex-1" />
                  <Skeleton className="h-10 flex-1" />
                  <Skeleton className="h-10 w-24" />
                </div>
              ))}
            </div>
          ) : stocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Package className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground">No stock entries found</h3>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Stock data will appear here once production entries are created
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Brick Type</TableHead>
                    <TableHead className="text-right">Opening Stock</TableHead>
                    <TableHead className="text-right">Current Stock</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stocks.map((stock) => {
                    const status = getStatusConfig(stock.currentStock)
                    return (
                      <TableRow key={stock.id}>
                        <TableCell className="font-medium">{stock.brickType}</TableCell>
                        <TableCell className="text-right font-mono">
                          {enIN.format(stock.openingStock)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          {enIN.format(stock.currentStock)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={status.className}>
                            {status.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Low Stock Alert Section */}
      {!loading && lowStockItems.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
            <h2 className="text-lg font-semibold text-rose-700 dark:text-rose-400">
              Low Stock Alerts
            </h2>
            <Badge
              variant="outline"
              className="bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800"
            >
              {lowStockItems.length} {lowStockItems.length === 1 ? 'item' : 'items'}
            </Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {lowStockItems.map((stock) => (
              <Card
                key={stock.id}
                className="border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/20"
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center justify-between">
                    <span className="text-rose-800 dark:text-rose-300">{stock.brickType}</span>
                    <Badge
                      variant="outline"
                      className="bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800"
                    >
                      Critical
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Current Stock</span>
                      <span className="font-bold text-rose-700 dark:text-rose-400">
                        {enIN.format(stock.currentStock)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Opening Stock</span>
                      <span className="text-rose-600 dark:text-rose-400/70">
                        {enIN.format(stock.openingStock)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Deficit from Threshold</span>
                      <span className="font-semibold text-rose-700 dark:text-rose-400">
                        {enIN.format(100 - stock.currentStock)}
                      </span>
                    </div>
                    {/* Progress bar showing stock level relative to 100 threshold */}
                    <div className="w-full bg-rose-200 dark:bg-rose-900/50 rounded-full h-2 mt-1">
                      <div
                        className="bg-rose-500 dark:bg-rose-400 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min((stock.currentStock / 100) * 100, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Updated: {formatUpdatedAt(stock.updatedAt)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
