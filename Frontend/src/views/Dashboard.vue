<template>
  <div class="min-h-screen p-6">
    <div class="max-w-6xl mx-auto">
      <div class="flex items-end justify-between">
        <div>
          <div class="flex items-end justify-between">
            <div>
              <h1 class="text-2xl font-semibold mb-1">Dashboard</h1>
              <p class="text-sm text-slate-600 dark:text-slate-400">Statistik dan ringkasan pemantauan pelampung pintar.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Controls toolbar -->
      <div class="mt-4 bg-white dark:bg-slate-800 dark:border dark:border-slate-700 p-3 rounded-lg shadow">
          <div class="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div class="grid gap-1">
            <label class="text-xs text-slate-600 dark:text-slate-300">Bulan</label>
            <select v-model.number="filters.month" class="rounded-md border px-2 py-2 bg-white dark:bg-slate-900 dark:border-slate-700">
              <option v-for="m in 12" :key="m" :value="m">{{ m }}</option>
            </select>
          </div>
          <div class="grid gap-1">
            <label class="text-xs text-slate-600 dark:text-slate-300">Tahun</label>
            <select v-model.number="filters.year" class="rounded-md border px-2 py-2 bg-white dark:bg-slate-900 dark:border-slate-700">
              <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}</option>
            </select>
          </div>
          <div class="grid gap-1 md:col-span-2">
            <label class="text-xs text-slate-600 dark:text-slate-300">Alat</label>
            <select v-model="filters.alatId" class="rounded-md border px-2 py-2 bg-white dark:bg-slate-900 dark:border-slate-700">
              <option value="">Semua alat</option>
              <option v-for="id in alatOptions" :key="id" :value="id">{{ id }}</option>
            </select>
          </div>
          <div class="grid gap-2">
            <label class="text-xs text-slate-600 dark:text-slate-300">Penyegaran</label>
            <div class="flex items-center gap-2">
              <label class="flex items-center gap-2 text-xs">
                <input type="checkbox" v-model="autoRefresh" /> Auto
              </label>
              <button @click="refreshAll()" :disabled="isRefreshing"
                class="rounded-md bg-blue-600 text-white px-3 py-2 text-xs font-medium hover:bg-blue-500 disabled:opacity-60">
                {{ isRefreshing ? 'Menyegarkan...' : 'Segarkan' }}
              </button>
              <span class="ml-2 text-[11px] text-slate-500 dark:text-slate-400">Terakhir diperbarui: {{ lastRefreshedText }}</span>
            </div>
          </div>
        </div>
      </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div class="bg-white dark:bg-slate-800 dark:border dark:border-slate-700 p-4 rounded-lg shadow">
              <h3 class="text-sm text-slate-500">Total Alat</h3>
              <p class="text-2xl font-bold">{{ totalAlat ?? '-' }}</p>
            </div>
            <div class="bg-white dark:bg-slate-800 dark:border dark:border-slate-700 p-4 rounded-lg shadow">
              <h3 class="text-sm text-slate-500">Alat Aktif (1 jam)</h3>
              <p class="text-2xl font-bold">{{ totalAktif ?? '-' }}</p>
            </div>
            <div class="bg-white dark:bg-slate-800 dark:border dark:border-slate-700 p-4 rounded-lg shadow">
              <h3 class="text-sm text-slate-500">Last update</h3>
              <p class="text-sm">{{ lastUpdateText }}</p>
            </div>
          </div>

          <div class="mt-6 bg-white dark:bg-slate-800 dark:border dark:border-slate-700 p-4 rounded-lg shadow">
            <h3 class="text-lg font-semibold mb-2">Lokasi Terakhir Per Alat</h3>
            <div v-if="loading" class="text-sm text-slate-500 dark:text-slate-400">Memuat...</div>
            <div v-else-if="Object.keys(lokasiTerakhir || {}).length === 0" class="text-sm text-slate-500 dark:text-slate-400">Tidak ada data lokasi.</div>
            <div v-else class="overflow-x-auto">
              <table class="min-w-full border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden text-sm">
                <thead class="bg-slate-50 dark:bg-slate-900/50 sticky top-0 z-10">
                  <tr>
                    <th class="text-left px-3 py-2 border-b dark:border-slate-700">#</th>
                    <th class="text-left px-3 py-2 border-b dark:border-slate-700">Alat ID</th>
                    <th class="text-left px-3 py-2 border-b dark:border-slate-700">Status</th>
                    <th class="text-left px-3 py-2 border-b dark:border-slate-700">Latitude</th>
                    <th class="text-left px-3 py-2 border-b dark:border-slate-700">Longitude</th>
                    <th class="text-left px-3 py-2 border-b dark:border-slate-700">Waktu</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, idx) in lokasiRows" :key="row.id" class="hover:bg-slate-50 dark:hover:bg-slate-900/40 odd:bg-slate-50/40 dark:odd:bg-slate-900/20">
                    <td class="px-3 py-2 border-b dark:border-slate-700">{{ idx + 1 }}</td>
                    <td class="px-3 py-2 border-b dark:border-slate-700 font-medium">{{ row.id }}</td>
                    <td class="px-3 py-2 border-b dark:border-slate-700">{{ row.status }}</td>
                    <td class="px-3 py-2 border-b dark:border-slate-700">{{ row.latitude }}</td>
                    <td class="px-3 py-2 border-b dark:border-slate-700">{{ row.longitude }}</td>
                    <td class="px-3 py-2 border-b dark:border-slate-700">{{ formatTimestamp(row.timestamp) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="mt-6 bg-white dark:bg-slate-800 dark:border dark:border-slate-700 p-4 rounded-lg shadow">
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-lg font-semibold">Rekap Bulanan Penggunaan Alat</h3>
              <div class="flex items-center gap-3">
                <button @click="exportCSV(monthly.data, ['alatId','usageCount'], 'rekap-bulanan.csv')" v-if="monthly?.data?.length"
                        class="rounded-md border px-2.5 py-1 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900/60">Export CSV</button>
                <div class="text-xs text-slate-500 dark:text-slate-400">Bulan: {{ monthly?.month }}/{{ monthly?.year }}</div>
              </div>
            </div>
            <div v-if="monthlyLoading" class="text-sm text-slate-500 dark:text-slate-400">Memuat...</div>
            <div v-else-if="!monthly?.data?.length" class="text-sm text-slate-500 dark:text-slate-400">Belum ada data penggunaan bulan ini.</div>
            <div v-else class="overflow-x-auto">
              <table class="min-w-full border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden text-sm">
                <thead class="bg-slate-50 dark:bg-slate-900/50 sticky top-0 z-10">
                  <tr>
                    <th class="text-left px-3 py-2 border-b dark:border-slate-700">#</th>
                    <th class="text-left px-3 py-2 border-b dark:border-slate-700">Alat ID</th>
                    <th class="text-left px-3 py-2 border-b dark:border-slate-700">Jumlah On</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, idx) in monthly.data" :key="row.alatId" class="hover:bg-slate-50 dark:hover:bg-slate-900/40 odd:bg-slate-50/40 dark:odd:bg-slate-900/20">
                    <td class="px-3 py-2 border-b dark:border-slate-700">{{ idx + 1 }}</td>
                    <td class="px-3 py-2 border-b dark:border-slate-700 font-medium">{{ row.alatId }}</td>
                    <td class="px-3 py-2 border-b dark:border-slate-700">{{ row.usageCount }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="bg-white dark:bg-slate-800 dark:border dark:border-slate-700 p-4 rounded-lg shadow">
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-lg font-semibold">Riwayat Bulanan (6 bulan)</h3>
              </div>
              <div v-if="historyLoading" class="text-sm text-slate-500 dark:text-slate-400">Memuat...</div>
              <div v-else-if="!monthlyHistory?.data?.length" class="text-sm text-slate-500 dark:text-slate-400">Tidak ada data.</div>
              <div v-else class="overflow-x-auto">
                <table class="min-w-full border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden text-sm">
                  <thead class="bg-slate-50 dark:bg-slate-900/50 sticky top-0 z-10">
                    <tr>
                      <th class="text-left px-3 py-2 border-b dark:border-slate-700">Bulan</th>
                      <th class="text-left px-3 py-2 border-b dark:border-slate-700">Jumlah On</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in monthlyHistory.data" :key="row.year+'-'+row.month" class="hover:bg-slate-50 dark:hover:bg-slate-900/40 odd:bg-slate-50/40 dark:odd:bg-slate-900/20">
                      <td class="px-3 py-2 border-b dark:border-slate-700">{{ row.month }}/{{ row.year }}</td>
                      <td class="px-3 py-2 border-b dark:border-slate-700">{{ row.usageCount }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div class="bg-white dark:bg-slate-800 dark:border dark:border-slate-700 p-4 rounded-lg shadow">
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-lg font-semibold">Tren Harian (kalender)</h3>
              </div>
              <div v-if="dailyLoading" class="text-sm text-slate-500 dark:text-slate-400">Memuat...</div>
              <div v-else-if="!dailyTrend?.data?.length" class="text-sm text-slate-500 dark:text-slate-400">Tidak ada data.</div>
              <div v-else class="">
                <div class="flex items-center justify-between mb-2">
                  <div class="text-xs text-slate-500 dark:text-slate-400">Bulan: {{ filters.month }}/{{ filters.year }}</div>
                  <div class="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                    <span>Legend:</span>
                    <span class="w-4 h-4 rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900/50"></span>
                    <span class="w-4 h-4 rounded bg-emerald-100 dark:bg-emerald-900/40"></span>
                    <span class="w-4 h-4 rounded bg-emerald-300 dark:bg-emerald-800/60"></span>
                    <span class="w-4 h-4 rounded bg-emerald-500 dark:bg-emerald-700/70"></span>
                    <span class="w-4 h-4 rounded bg-emerald-700 dark:bg-emerald-600/80"></span>
                  </div>
                </div>
                <div class="grid grid-cols-7 text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  <div class="px-1 py-1">Sen</div>
                  <div class="px-1 py-1">Sel</div>
                  <div class="px-1 py-1">Rab</div>
                  <div class="px-1 py-1">Kam</div>
                  <div class="px-1 py-1">Jum</div>
                  <div class="px-1 py-1">Sab</div>
                  <div class="px-1 py-1">Min</div>
                </div>
                <div class="grid grid-cols-7 gap-1">
                  <template v-for="(week, wi) in calendarWeeks" :key="wi">
                    <template v-for="d in week" :key="d.iso">
                      <div class="aspect-square rounded-md border text-[11px]"
                           :class="dayBgClass(d.count, d.inMonth)"
                           :title="`${d.iso}: ${d.count ?? 0}`">
                        <div class="p-1 flex flex-col h-full">
                          <div class="text-[10px]">
                            {{ new Date(d.iso).getDate() }}
                          </div>
                          <div class="mt-auto text-[10px] font-medium" v-if="d.inMonth && d.count">
                            {{ d.count }}
                          </div>
                        </div>
                      </div>
                    </template>
                  </template>
                </div>
              </div>
            </div>
          </div>

          <div class="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="bg-white dark:bg-slate-800 dark:border dark:border-slate-700 p-4 rounded-lg shadow">
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-lg font-semibold">Breakdown Status (bulan ini)</h3>
              </div>
              <div v-if="breakdownLoading" class="text-sm text-slate-500 dark:text-slate-400">Memuat...</div>
              <div v-else-if="!statusBreakdown?.data?.length" class="text-sm text-slate-500 dark:text-slate-400">Tidak ada data.</div>
              <div v-else class="overflow-x-auto">
                <table class="min-w-full border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden text-sm">
                  <thead class="bg-slate-50 dark:bg-slate-900/50 sticky top-0 z-10">
                    <tr>
                      <th class="text-left px-3 py-2 border-b dark:border-slate-700">Status</th>
                      <th class="text-left px-3 py-2 border-b dark:border-slate-700">Jumlah</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in statusBreakdown.data" :key="row.status" class="hover:bg-slate-50 dark:hover:bg-slate-900/40 odd:bg-slate-50/40 dark:odd:bg-slate-900/20">
                      <td class="px-3 py-2 border-b dark:border-slate-700">{{ row.status }}</td>
                      <td class="px-3 py-2 border-b dark:border-slate-700">{{ row.count }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div class="bg-white dark:bg-slate-800 dark:border dark:border-slate-700 p-4 rounded-lg shadow">
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-lg font-semibold">Top Alat (bulan ini)</h3>
              </div>
              <div v-if="topLoading" class="text-sm text-slate-500 dark:text-slate-400">Memuat...</div>
              <div v-else-if="!topAlat?.data?.length" class="text-sm text-slate-500 dark:text-slate-400">Tidak ada data.</div>
              <div v-else class="overflow-x-auto">
                <table class="min-w-full border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden text-sm">
                  <thead class="bg-slate-50 dark:bg-slate-900/50 sticky top-0 z-10">
                    <tr>
                      <th class="text-left px-3 py-2 border-b dark:border-slate-700">#</th>
                      <th class="text-left px-3 py-2 border-b dark:border-slate-700">Alat ID</th>
                      <th class="text-left px-3 py-2 border-b dark:border-slate-700">Jumlah On</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(row, idx) in topAlat.data" :key="row.alatId" class="hover:bg-slate-50 dark:hover:bg-slate-900/40 odd:bg-slate-50/40 dark:odd:bg-slate-900/20">
                      <td class="px-3 py-2 border-b dark:border-slate-700">{{ idx + 1 }}</td>
                      <td class="px-3 py-2 border-b dark:border-slate-700">{{ row.alatId }}</td>
                      <td class="px-3 py-2 border-b dark:border-slate-700">{{ row.usageCount }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
    </div>
  </div>
</template>

<script setup>
  import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
    import api from '../services/api'

    const totalAlat = ref(null)
    const totalAktif = ref(null)
    const lokasiTerakhir = ref({})
  const loading = ref(true)
  const monthly = ref({ month: null, year: null, data: [] })
  const monthlyLoading = ref(true)
  const monthlyHistory = ref({ data: [] })
  const historyLoading = ref(true)
  const dailyTrend = ref({ data: [] })
  const dailyLoading = ref(true)
  const statusBreakdown = ref({ data: [] })
  const breakdownLoading = ref(true)
  const topAlat = ref({ data: [] })
  const topLoading = ref(true)
  const autoRefresh = ref(true)
  const isRefreshing = ref(false)
  const lastRefreshed = ref(null)
  const lastRefreshedText = computed(() => lastRefreshed.value ? new Date(lastRefreshed.value).toLocaleTimeString() : '-')

  // Filters state
  const now = new Date()
  const filters = ref({
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    alatId: ''
  })
  const yearOptions = computed(() => {
    const y = now.getFullYear()
    return [y - 2, y - 1, y, y + 1]
  })
  const alatOptions = computed(() => {
    // Prefer alat ids from monthly recap or fallback to keys seen in lokasiTerakhir
    const ids = new Set()
    if (monthly.value?.data?.length) {
      for (const r of monthly.value.data) ids.add(r.alatId)
    }
    for (const k of Object.keys(lokasiTerakhir.value || {})) ids.add(k)
    return Array.from(ids).sort()
  })

  // Table rows for lokasi (sorted by alatId)
  const lokasiRows = computed(() => {
    const entries = Object.entries(lokasiTerakhir.value || {})
    entries.sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    return entries.map(([id, loc]) => ({ id, ...loc }))
  })

  // Daily trend calendar helpers
  const dailyMap = computed(() => {
    const map = new Map()
    for (const row of (dailyTrend.value?.data || [])) {
      map.set(row.day, Number(row.usageCount) || 0)
    }
    return map
  })
  const maxUsage = computed(() => {
    let m = 0
    for (const v of dailyMap.value.values()) m = Math.max(m, v)
    return m
  })
  function dayBgClass(count, inMonth) {
    const baseBorder = inMonth ? 'dark:border-slate-700 border-slate-200' : 'border-transparent'
    const off = 'bg-slate-100 dark:bg-slate-900/40'
    if (!inMonth) return `border ${baseBorder} ${off}`
    if (!count) return `border ${baseBorder} ${off}`
    // quintile buckets
    const q = maxUsage.value ? count / maxUsage.value : 0
    if (q >= 0.8) return `border ${baseBorder} bg-emerald-700 dark:bg-emerald-600/80 text-white`
    if (q >= 0.6) return `border ${baseBorder} bg-emerald-500 dark:bg-emerald-700/70 text-white`
    if (q >= 0.4) return `border ${baseBorder} bg-emerald-300 dark:bg-emerald-800/60`
    if (q >= 0.2) return `border ${baseBorder} bg-emerald-100 dark:bg-emerald-900/40`
    return `border ${baseBorder} ${off}`
  }
  const calendarWeeks = computed(() => {
    // Build a Monday-first month grid for selected filters
    const y = filters.value.year
    const m = filters.value.month - 1
    const first = new Date(y, m, 1)
    const last = new Date(y, m + 1, 0)
    const daysInMonth = last.getDate()
    // Determine Monday-first index for the first day
    const jsDayToMonFirst = (d) => (d + 6) % 7 // 0=Sun -> 6, 1=Mon -> 0
    const startPad = jsDayToMonFirst(first.getDay())
    const weeks = []
    let week = []
    // pad previous month days
    for (let i = 0; i < startPad; i++) {
      // previous days placeholders
      const d = new Date(first)
      d.setDate(d.getDate() - (startPad - i))
      const yyyy = d.getFullYear(), mm = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0')
      const iso = `${yyyy}-${mm}-${dd}`
      week.push({ iso, count: null, inMonth: false })
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(y, m, day)
      const yyyy = d.getFullYear(), mm = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0')
      const iso = `${yyyy}-${mm}-${dd}`
      const count = dailyMap.value.get(iso) ?? 0
      week.push({ iso, count, inMonth: true })
      if (week.length === 7) {
        weeks.push(week)
        week = []
      }
    }
    // pad next month days to complete the grid
    if (week.length) {
      const remain = 7 - week.length
      const d = new Date(last)
      for (let i = 1; i <= remain; i++) {
        const ddx = new Date(d)
        ddx.setDate(d.getDate() + i)
        const yyyy = ddx.getFullYear(), mm = String(ddx.getMonth() + 1).padStart(2, '0'), dd = String(ddx.getDate()).padStart(2, '0')
        const iso = `${yyyy}-${mm}-${dd}`
        week.push({ iso, count: null, inMonth: false })
      }
      weeks.push(week)
    }
    return weeks
  })

    const fetchDashboard = async () => {
      loading.value = true
      try {
        const res = await api.get('/dashboard')
        totalAlat.value = res.data.totalAlat
        totalAktif.value = res.data.totalAktif
        lokasiTerakhir.value = res.data.lokasiTerakhir || {}
      } catch (e) {
        console.error('Error fetching dashboard:', e)
      } finally {
        loading.value = false
      }
    }

    let poller = null
    async function refreshAll() {
      isRefreshing.value = true
      try {
        await Promise.all([
          fetchDashboard(),
          fetchMonthly(),
          fetchMonthlyHistory(),
          fetchDailyTrend(),
          fetchStatusBreakdown(),
          fetchTopAlat()
        ])
      } finally {
        isRefreshing.value = false
        lastRefreshed.value = Date.now()
      }
    }

    onMounted(() => {
      refreshAll()
      poller = setInterval(() => { if (autoRefresh.value) refreshAll() }, 30000)
    })

    onBeforeUnmount(() => {
      if (poller) clearInterval(poller)
    })

    const lastUpdateText = computed(() => {
      const keys = Object.keys(lokasiTerakhir.value)
      if (!keys.length) return '-'
      // find latest timestamp
      let latest = 0
      for (const id of keys) {
        const t = new Date(lokasiTerakhir.value[id].timestamp).getTime()
        if (t > latest) latest = t
      }
      return new Date(latest).toLocaleString()
    })

    function formatTimestamp(ts) {
      try { return new Date(ts).toLocaleString() } catch { return ts }
    }

    async function fetchMonthly() {
      monthlyLoading.value = true
      try {
        const res = await api.get('/dashboard/monthly-recap', { params: { month: filters.value.month, year: filters.value.year } })
        monthly.value = res.data || { month: null, year: null, data: [] }
      } catch (e) {
        console.error('Error fetching monthly recap:', e)
      } finally {
        monthlyLoading.value = false
      }
    }

    async function fetchMonthlyHistory() {
      historyLoading.value = true
      try {
        const params = { months: 6 }
        if (filters.value.alatId) params.alatId = filters.value.alatId
        const res = await api.get('/dashboard/monthly-history', { params })
        monthlyHistory.value = res.data || { data: [] }
      } catch (e) {
        console.error('Error fetching monthly history:', e)
      } finally {
        historyLoading.value = false
      }
    }

    async function fetchDailyTrend() {
      dailyLoading.value = true
      try {
        const start = new Date(filters.value.year, filters.value.month - 1, 1).toISOString()
        const end = new Date(filters.value.year, filters.value.month, 0, 23, 59, 59, 999).toISOString()
        const params = { start, end }
        if (filters.value.alatId) params.alatId = filters.value.alatId
        const res = await api.get('/dashboard/daily-trend', { params })
        dailyTrend.value = res.data || { data: [] }
      } catch (e) {
        console.error('Error fetching daily trend:', e)
      } finally {
        dailyLoading.value = false
      }
    }

    async function fetchStatusBreakdown() {
      breakdownLoading.value = true
      try {
        const params = { month: filters.value.month, year: filters.value.year }
        if (filters.value.alatId) params.alatId = filters.value.alatId
        const res = await api.get('/dashboard/status-breakdown', { params })
        statusBreakdown.value = res.data || { data: [] }
      } catch (e) {
        console.error('Error fetching status breakdown:', e)
      } finally {
        breakdownLoading.value = false
      }
    }

    async function fetchTopAlat() {
      topLoading.value = true
      try {
        const res = await api.get('/dashboard/top-alat', { params: { month: filters.value.month, year: filters.value.year, limit: 5 } })
        topAlat.value = res.data || { data: [] }
      } catch (e) {
        console.error('Error fetching top alat:', e)
      } finally {
        topLoading.value = false
      }
    }

    // Re-fetch when filters change
    watch(filters, () => {
      refreshAll()
    }, { deep: true })

    // CSV export helper
    function exportCSV(rows, columns, filename = 'export.csv') {
      try {
        if (!Array.isArray(rows) || !rows.length) return
        const header = columns.join(',')
        const body = rows.map(r => columns.map(c => {
          const val = r[c] ?? ''
          // Escape quotes and commas
          const s = String(val).replace(/"/g, '""')
          return /[",\n]/.test(s) ? `"${s}"` : s
        }).join(',')).join('\n')
        const csv = header + '\n' + body
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } catch (e) {
        console.error('exportCSV error', e)
      }
    }
</script>
