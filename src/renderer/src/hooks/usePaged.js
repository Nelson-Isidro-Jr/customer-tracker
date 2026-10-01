import { useState, useEffect, useRef, useCallback } from 'react'

function readSize(key, fallback) {
  try { return Number(localStorage.getItem(key)) || fallback } catch (_) { return fallback }
}

// Loads one page at a time from an IPC channel. The previous page stays on
// screen while the next one loads (no flashing), stale responses are dropped,
// and the chosen page size is remembered per table.
export default function usePaged(channel, params, { sizeKey, defaultSize = 50, debounce = 0 } = {}) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSizeState] = useState(() => (sizeKey ? readSize(sizeKey, defaultSize) : defaultSize))
  const [data, setData] = useState({ rows: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(null)
  const req = useRef(0)
  const paramsKey = JSON.stringify(params)
  const lastParams = useRef(paramsKey)

  // Any filter change sends the user back to page 1
  useEffect(() => {
    if (lastParams.current !== paramsKey) {
      lastParams.current = paramsKey
      setPage(1)
    }
  }, [paramsKey])

  const load = useCallback(() => {
    const id = ++req.current
    setLoading(true)
    return window.electron.invoke(channel, { ...JSON.parse(paramsKey), page, pageSize })
      .then(res => {
        if (id !== req.current) return
        // If rows were deleted and this page is now past the end, step back
        const lastPage = Math.max(1, Math.ceil(res.total / pageSize))
        if (page > lastPage) { setPage(lastPage); return }
        setData(res)
        setError(null)
        setLoaded(true)
      })
      .catch(err => { if (id === req.current) setError(err) })
      .finally(() => { if (id === req.current) setLoading(false) })
  }, [channel, paramsKey, page, pageSize])

  useEffect(() => {
    if (!debounce) { load(); return }
    const t = setTimeout(load, debounce)
    return () => clearTimeout(t)
  }, [load, debounce])

  const setPageSize = useCallback(size => {
    setPageSizeState(size)
    setPage(1)
    if (sizeKey) { try { localStorage.setItem(sizeKey, String(size)) } catch (_) {} }
  }, [sizeKey])

  return { ...data, page, setPage, pageSize, setPageSize, loading, loaded, error, reload: load }
}
