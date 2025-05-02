import * as React from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChevronLeft, ChevronRight, Search } from "lucide-react"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

interface DataTableColumn<T> {
  key: string
  header: string
  renderHeader?: () => React.ReactNode
  render?: (item: T) => React.ReactNode
  sortable?: boolean
  width?: string
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  data: T[]
  rowKey: keyof T
  searchable?: boolean
  pagination?: boolean
  itemsPerPage?: number
  onSearch?: (query: string) => void
  onRowClick?: (item: T) => void
  actions?: (item: T) => React.ReactNode
  isLoading?: boolean
  className?: string
  searchPlaceholder?: string
  emptyMessage?: string
}

function DataTable<T>({
  columns,
  data,
  rowKey,
  searchable = false,
  pagination = true,
  itemsPerPage = 10,
  onSearch,
  onRowClick,
  actions,
  isLoading = false,
  className,
  searchPlaceholder = "Search...",
  emptyMessage = "No items found.",
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [sortConfig, setSortConfig] = useState<{
    key: string | null
    direction: "asc" | "desc" | null
  }>({ key: null, direction: null })

  const filteredData = React.useMemo(() => {
    let filtered = [...data]

    // Client-side filtering if onSearch is not provided
    if (searchQuery && !onSearch) {
      filtered = filtered.filter((item) => {
        return Object.values(item as Record<string, any>).some((value) => {
          if (value === null || value === undefined) return false
          return String(value).toLowerCase().includes(searchQuery.toLowerCase())
        })
      })
    }

    // Client-side sorting
    if (sortConfig.key && sortConfig.direction) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key as keyof T]
        const bValue = b[sortConfig.key as keyof T]

        if (aValue === bValue) return 0
        if (aValue === null || aValue === undefined) return 1
        if (bValue === null || bValue === undefined) return -1

        if (
          typeof aValue === "string" &&
          typeof bValue === "string"
        ) {
          return sortConfig.direction === "asc"
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue)
        }

        // @ts-ignore
        return sortConfig.direction === "asc" ? aValue - bValue : bValue - aValue
      })
    }

    return filtered
  }, [data, searchQuery, sortConfig, onSearch])

  const paginatedData = React.useMemo(() => {
    if (!pagination) return filteredData
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredData.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredData, currentPage, itemsPerPage, pagination])

  const totalPages = React.useMemo(() => {
    return Math.ceil(filteredData.length / itemsPerPage)
  }, [filteredData.length, itemsPerPage])

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" | null = "asc"
    if (sortConfig.key === key) {
      if (sortConfig.direction === "asc") {
        direction = "desc"
      } else if (sortConfig.direction === "desc") {
        direction = null
      }
    }
    setSortConfig({ key, direction })
  }

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchQuery(value)
    setCurrentPage(1)
    if (onSearch) {
      onSearch(value)
    }
  }

  // Reset page when data changes
  useEffect(() => {
    setCurrentPage(1)
  }, [data.length])

  return (
    <div className={cn("w-full", className)}>
      {searchable && (
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={handleSearch}
              className="pl-10"
            />
          </div>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  className={column.sortable ? "cursor-pointer" : ""}
                  onClick={column.sortable ? () => handleSort(column.key) : undefined}
                  style={column.width ? { width: column.width } : undefined}
                >
                  {column.renderHeader ? (
                    column.renderHeader()
                  ) : (
                    <div className="flex items-center">
                      {column.header}
                      {column.sortable && sortConfig.key === column.key && (
                        <span className="ml-1">
                          {sortConfig.direction === "asc" ? " ↑" : " ↓"}
                        </span>
                      )}
                    </div>
                  )}
                </TableHead>
              ))}
              {actions && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (actions ? 1 : 0)}
                  className="h-24 text-center"
                >
                  Loading...
                </TableCell>
              </TableRow>
            ) : paginatedData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (actions ? 1 : 0)}
                  className="h-24 text-center"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((item) => (
                <TableRow
                  key={String(item[rowKey])}
                  className={onRowClick ? "cursor-pointer hover:bg-accent/50" : ""}
                  onClick={onRowClick ? () => onRowClick(item) : undefined}
                >
                  {columns.map((column) => (
                    <TableCell key={`${String(item[rowKey])}-${column.key}`}>
                      {column.render
                        ? column.render(item)
                        : (item[column.key as keyof T] as React.ReactNode) || "-"}
                    </TableCell>
                  ))}
                  {actions && (
                    <TableCell className="text-right">{actions(item)}</TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
            {Math.min(currentPage * itemsPerPage, filteredData.length)} of{" "}
            {filteredData.length} results
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm">
              Page {currentPage} of {totalPages}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export { DataTable }
