import { useEffect, useRef, useState } from 'react'
import { api, type SlotPayload } from '../api'

const EMPTY = {
  startTime: '14:00',
  endTime: '15:30',
  maxCapacity: 8,
}

function moveItem<T>(items: T[], from: number, to: number) {
  if (from === to || from < 0 || to < 0) return items
  const next = [...items]
  const [row] = next.splice(from, 1)
  next.splice(to, 0, row)
  return next
}

function sameIds(left: number[], right: number[]) {
  return left.length === right.length && left.every((id, index) => id === right[index])
}

type DragVisual = {
  id: number
  width: number
  x: number
  y: number
}

function SlotCard({
  slot,
  onUpdate,
  onHandlePointerDown,
  onHandlePointerMove,
  onHandlePointerUp,
  lifted,
}: {
  slot: SlotPayload
  onUpdate: (slot: SlotPayload, patch: Partial<SlotPayload>) => void
  onHandlePointerDown?: (event: React.PointerEvent<HTMLButtonElement>) => void
  onHandlePointerMove?: (event: React.PointerEvent<HTMLButtonElement>) => void
  onHandlePointerUp?: (event: React.PointerEvent<HTMLButtonElement>) => void
  lifted?: boolean
}) {
  return (
    <article
      className={`flex gap-3 rounded-xl border bg-white p-3 md:p-4 ${
        lifted ? 'border-forest shadow-lg' : 'border-line'
      }`}
    >
      <button
        type="button"
        className="mt-1 h-10 w-8 shrink-0 cursor-grab touch-none rounded-md text-bark active:cursor-grabbing"
        aria-label="拖动排序"
        onPointerDown={onHandlePointerDown}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
        onPointerCancel={onHandlePointerUp}
      >
        ⋮⋮
      </button>
      <div className="min-w-0 flex-1">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className={slot.isActive ? 'text-sm text-moss' : 'text-sm text-bark'}>
            {slot.isActive ? '可预约' : '已下线'}
          </span>
          <button
            type="button"
            className="text-sm text-moss"
            onClick={() => onUpdate(slot, { isActive: !slot.isActive })}
          >
            {slot.isActive ? '下线' : '重新上线'}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-[1fr_1fr_120px]">
          <label className="grid gap-1 text-sm">
            <span className="text-bark">开始</span>
            <input
              type="time"
              className="w-full rounded-md border border-line px-2 py-1.5"
              value={slot.startTime}
              onChange={(e) => onUpdate(slot, { startTime: e.target.value })}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-bark">结束</span>
            <input
              type="time"
              className="w-full rounded-md border border-line px-2 py-1.5"
              value={slot.endTime}
              onChange={(e) => onUpdate(slot, { endTime: e.target.value })}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-bark">名额</span>
            <input
              type="number"
              min={1}
              className="w-full rounded-md border border-line px-2 py-1.5"
              value={slot.maxCapacity}
              onChange={(e) => onUpdate(slot, { maxCapacity: Number(e.target.value) })}
            />
          </label>
        </div>
      </div>
    </article>
  )
}

export function SlotsPage() {
  const [slots, setSlots] = useState<SlotPayload[]>([])
  const [draft, setDraft] = useState(EMPTY)
  const [message, setMessage] = useState('')
  const [dragVisual, setDragVisual] = useState<DragVisual | null>(null)
  const savedIdsRef = useRef<number[]>([])
  const draggingIdRef = useRef<number | null>(null)
  const slotsRef = useRef<SlotPayload[]>([])
  const dragOffsetRef = useRef({ x: 0, y: 0 })

  async function reload() {
    const rows = await api.listSlots()
    slotsRef.current = rows
    setSlots(rows)
    savedIdsRef.current = rows.map((row) => row.id)
  }

  useEffect(() => {
    reload().catch((err: Error) => setMessage(err.message))
  }, [])

  async function onCreate() {
    setMessage('')
    try {
      await api.createSlot(draft)
      setDraft(EMPTY)
      await reload()
      setMessage('已新增时段。已有预约仍显示当时的时间。')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '新增失败')
    }
  }

  async function onUpdate(slot: SlotPayload, patch: Partial<SlotPayload>) {
    setMessage('')
    try {
      await api.updateSlot(slot.id, patch)
      await reload()
      setMessage('时段已更新。历史预约仍保留下单时的时间快照。')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '更新失败')
    }
  }

  function moveDraggingTo(targetId: number) {
    const currentId = draggingIdRef.current
    if (currentId === null || currentId === targetId) return
    setSlots((prev) => {
      const from = prev.findIndex((row) => row.id === currentId)
      const to = prev.findIndex((row) => row.id === targetId)
      const next = moveItem(prev, from, to)
      slotsRef.current = next
      return next
    })
  }

  async function persistOrder() {
    const ids = slotsRef.current.map((row) => row.id)
    draggingIdRef.current = null
    setDragVisual(null)
    if (sameIds(ids, savedIdsRef.current)) return
    try {
      const rows = await api.reorderSlots(ids)
      slotsRef.current = rows
      setSlots(rows)
      savedIdsRef.current = rows.map((row) => row.id)
      setMessage('排序已更新，小程序会按这个顺序显示。')
    } catch (err) {
      await reload().catch(() => undefined)
      setMessage(err instanceof Error ? err.message : '排序保存失败')
    }
  }

  function onHandlePointerDown(slot: SlotPayload, event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault()
    const card = event.currentTarget.closest('[data-slot-id]')
    if (!(card instanceof HTMLElement)) return
    const rect = card.getBoundingClientRect()
    draggingIdRef.current = slot.id
    dragOffsetRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
    setDragVisual({
      id: slot.id,
      width: rect.width,
      x: rect.left,
      y: rect.top,
    })
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onHandlePointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    if (draggingIdRef.current === null) return
    setDragVisual((prev) =>
      prev
        ? {
            ...prev,
            x: event.clientX - dragOffsetRef.current.x,
            y: event.clientY - dragOffsetRef.current.y,
          }
        : prev,
    )
    const node = document.elementFromPoint(event.clientX, event.clientY)
    const card = node?.closest('[data-slot-id]')
    if (!card) return
    moveDraggingTo(Number(card.getAttribute('data-slot-id')))
  }

  const draggingSlot = dragVisual ? slots.find((row) => row.id === dragVisual.id) : null

  return (
    <div className="w-full max-w-4xl">
      <p className="mb-6 mt-0 text-sm leading-6 text-bark md:text-base">
        这里改的是「可预约模板」。按住左侧拖动整条时段可改小程序里的显示顺序。改时间、名额或下线，都不会把以前的预约改掉。
      </p>
      <div className="mb-6 grid grid-cols-1 items-end gap-3 rounded-xl bg-cream p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_120px_auto]">
        <label className="grid gap-1.5">
          <span className="text-sm text-bark">开始</span>
          <input
            type="time"
            className="w-full rounded-lg border border-line bg-white px-3 py-2"
            value={draft.startTime}
            onChange={(e) => setDraft((prev) => ({ ...prev, startTime: e.target.value }))}
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm text-bark">结束</span>
          <input
            type="time"
            className="w-full rounded-lg border border-line bg-white px-3 py-2"
            value={draft.endTime}
            onChange={(e) => setDraft((prev) => ({ ...prev, endTime: e.target.value }))}
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm text-bark">名额</span>
          <input
            type="number"
            min={1}
            className="w-full rounded-lg border border-line bg-white px-3 py-2"
            value={draft.maxCapacity}
            onChange={(e) => setDraft((prev) => ({ ...prev, maxCapacity: Number(e.target.value) }))}
          />
        </label>
        <button
          type="button"
          className="h-[42px] w-full rounded-[10px] bg-forest px-4 text-cream lg:w-auto"
          onClick={onCreate}
        >
          新增时段
        </button>
      </div>

      <div className="grid gap-3">
        {slots.map((slot) => (
          <div
            key={slot.id}
            data-slot-id={slot.id}
            className={dragVisual?.id === slot.id ? 'opacity-0' : undefined}
          >
            <SlotCard
              slot={slot}
              onUpdate={onUpdate}
              onHandlePointerDown={(event) => onHandlePointerDown(slot, event)}
              onHandlePointerMove={onHandlePointerMove}
              onHandlePointerUp={() => {
                if (draggingIdRef.current === null) return
                void persistOrder()
              }}
            />
          </div>
        ))}
      </div>
      {dragVisual && draggingSlot ? (
        <div
          className="pointer-events-none fixed z-50"
          style={{ left: dragVisual.x, top: dragVisual.y, width: dragVisual.width }}
        >
          <SlotCard slot={draggingSlot} onUpdate={onUpdate} lifted />
        </div>
      ) : null}
      {message ? <p className="mt-4 text-moss">{message}</p> : null}
    </div>
  )
}
