import { MONTH_NAMES, addDays, sameDay, startOfToday } from '../../utils/date'

interface CalCell {
  key: string
  empty: boolean
  day: number
  ts: number
  disabled: boolean
  isSel: boolean
  isToday: boolean
}

Component({
  properties: {
    show: {
      type: Boolean,
      value: false,
    },
    selectedTs: {
      type: Number,
      value: 0,
    },
  },
  data: {
    viewYear: 2026,
    viewMonth: 0,
    canPrev: false,
    canNext: true,
    cells: [] as CalCell[],
    monthLabel: '',
    weekdays: ['日', '一', '二', '三', '四', '五', '六'],
  },
  observers: {
    'show, selectedTs'(show: boolean) {
      if (!show) return
      const selected = this.data.selectedTs || startOfToday()
      const d = new Date(selected)
      this.rebuild(d.getFullYear(), d.getMonth())
    },
  },
  methods: {
    rebuild(nextYear?: number, nextMonth?: number) {
      const viewYear = nextYear ?? this.data.viewYear
      const viewMonth = nextMonth ?? this.data.viewMonth
      const { selectedTs } = this.data
      const today = startOfToday()
      const maxDate = addDays(today, 90)
      const selected = selectedTs || today
      const first = new Date(viewYear, viewMonth, 1)
      const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
      const cells: CalCell[] = []

      for (let i = 0; i < first.getDay(); i += 1) {
        cells.push({
          key: `e-${i}`,
          empty: true,
          day: 0,
          ts: 0,
          disabled: true,
          isSel: false,
          isToday: false,
        })
      }

      for (let day = 1; day <= daysInMonth; day += 1) {
        const ts = new Date(viewYear, viewMonth, day).getTime()
        cells.push({
          key: `d-${ts}`,
          empty: false,
          day,
          ts,
          disabled: ts < today || ts > maxDate,
          isSel: sameDay(ts, selected),
          isToday: sameDay(ts, today),
        })
      }

      const viewStart = new Date(viewYear, viewMonth, 1).getTime()
      const todayMonthStart = new Date(new Date(today).getFullYear(), new Date(today).getMonth(), 1).getTime()
      const maxMonthStart = new Date(new Date(maxDate).getFullYear(), new Date(maxDate).getMonth(), 1).getTime()

      this.setData({
        viewYear,
        viewMonth,
        cells,
        canPrev: viewStart > todayMonthStart,
        canNext: viewStart < maxMonthStart,
        monthLabel: `${viewYear}年 ${MONTH_NAMES[viewMonth]}`,
      })
    },
    onPrev() {
      if (!this.data.canPrev) return
      let { viewYear, viewMonth } = this.data
      if (viewMonth === 0) {
        viewYear -= 1
        viewMonth = 11
      } else {
        viewMonth -= 1
      }
      this.rebuild(viewYear, viewMonth)
    },
    onNext() {
      if (!this.data.canNext) return
      let { viewYear, viewMonth } = this.data
      if (viewMonth === 11) {
        viewYear += 1
        viewMonth = 0
      } else {
        viewMonth += 1
      }
      this.rebuild(viewYear, viewMonth)
    },
    onPick(e: WechatMiniprogram.TouchEvent) {
      const { ts, disabled } = e.currentTarget.dataset
      if (!ts || disabled === true || disabled === 'true') return
      this.triggerEvent('select', { ts: Number(ts) })
    },
    onClose() {
      this.triggerEvent('close')
    },
    noop() {},
  },
})
