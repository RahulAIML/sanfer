import { useEffect, useRef, useState } from 'react'
import { ChevronDown, LogOut } from 'lucide-react'
import { useAuthContext } from '../AuthProvider'

/**
 * The signed-in identity and the sign-out control.
 *
 * Signing out clears the stored session *and* every cached API response before
 * reloading, so a shared machine does not hand this dashboard's data to
 * whoever opens the browser next.
 */
export function UserMenu() {
  const { user, logout, isLoading } = useAuthContext()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const name = user?.full_name || user?.email || 'User'
  const initials =
    name
      .split(/\s+/)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'U'

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-xs font-bold text-blue-600 dark:text-blue-300">
          {initials}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-xs font-semibold leading-tight text-gray-800 dark:text-slate-200">
            {name}
          </span>
          <span className="block text-[10px] leading-tight text-gray-400 dark:text-slate-500">
            {user?.email}
          </span>
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 min-w-52 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-white/10 dark:bg-slate-800"
        >
          <div className="border-b border-gray-100 px-4 py-3 dark:border-white/10">
            <p className="text-sm font-semibold text-gray-800 dark:text-slate-100">{name}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400">{user?.email}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => void logout()}
            disabled={isLoading}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-500/10"
          >
            <LogOut className="h-4 w-4" />
            {isLoading ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  )
}
