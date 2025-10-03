<template>
  <header
    class="sticky top-0 z-40 border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:bg-slate-900/80 dark:border-slate-800"
  >
  <div class="mx-auto max-w-[1800px] px-2 sm:px-4 lg:px-6 h-14 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <button
          @click="$emit('toggleSidebar')"
          class="inline-flex items-center justify-center rounded-md border px-2 py-1 text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-800"
          aria-label="Toggle sidebar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M3 5h14a1 1 0 100-2H3a1 1 0 100 2zm14 4H3a1 1 0 000 2h14a1 1 0 100-2zm0 6H3a1 1 0 000 2h14a1 1 0 100-2z" clip-rule="evenodd" />
          </svg>
        </button>
        <div class="h-9 w-9 rounded-md bg-blue-600 text-white grid place-items-center font-bold">S</div>
        <div class="leading-tight">
          <h1 class="text-base sm:text-lg font-semibold text-slate-800 dark:text-slate-100 leading-tight">Sobat Nelayan</h1>
          <p class="text-[12px] sm:text-[13px] text-slate-500 dark:text-slate-400">Monitoring alat & lokasi</p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button
          @click="toggleTheme"
          class="inline-flex items-center gap-2 rounded-md border px-3.5 py-1.5 text-[13px] sm:text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-800"
          :aria-pressed="isDark"
          :title="isDark ? 'Switch to light' : 'Switch to dark'"
        >
          <svg v-if="!isDark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="h-4 w-4" fill="currentColor"><path d="M12 18a6 6 0 110-12 6 6 0 010 12zm0 4a1 1 0 001-1v-1a1 1 0 10-2 0v1a1 1 0 001 1zm0-20a1 1 0 00-1 1v1a1 1 0 102 0V3a1 1 0 00-1-1zM4 13a1 1 0 100-2H3a1 1 0 000 2h1zm17 0a1 1 0 100-2h-1a1 1 0 100 2h1zM6.343 19.778a1 1 0 001.414 0l.707-.707a1 1 0 10-1.414-1.414l-.707.707a1 1 0 000 1.414zM15.536 6.343a1 1 0 001.414 0l.707-.707A1 1 0 0016.243 4.2l-.707.707a1 1 0 000 1.414zM17.657 19.778a1 1 0 01-1.414 0l-.707-.707a1 1 0 111.414-1.414l.707.707a1 1 0 010 1.414zM7.757 6.343a1 1 0 01-1.414 0L5.636 5.636A1 1 0 117.05 4.222l.707.707a1 1 0 010 1.414z"/></svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
          <span class="hidden sm:inline">{{ isDark ? 'Dark' : 'Light' }}</span>
        </button>

        <button
          @click="logout"
          class="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3.5 py-1.5 text-[13px] sm:text-sm font-medium text-white hover:bg-blue-500"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="h-4 w-4" fill="currentColor"><path d="M12 3a1 1 0 011 1v6a1 1 0 11-2 0V4a1 1 0 011-1zm6.657 3.757a1 1 0 010 1.414l-1.414 1.415a1 1 0 11-1.415-1.415l1.415-1.414a1 1 0 011.414 0zM21 13a1 1 0 100-2h-1a1 1 0 100 2h1zM6.343 6.757a1 1 0 011.414 0L9.172 8.17a1 1 0 11-1.414 1.415L6.343 8.172a1 1 0 010-1.415zM4 13a1 1 0 100-2H3a1 1 0 000 2h1zm8 8a1 1 0 001-1v-1a1 1 0 10-2 0v1a1 1 0 001 1z"/></svg>
          <span class="hidden sm:inline">Keluar</span>
        </button>
      </div>
    </div>
  </header>
  </template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

defineEmits(['toggleSidebar'])

const router = useRouter()

const isDark = ref(
  localStorage.theme === 'dark' || (
    !('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches
  )
)

function applyTheme() {
  const root = document.documentElement
  if (isDark.value) {
    root.classList.add('dark')
    localStorage.theme = 'dark'
  } else {
    root.classList.remove('dark')
    localStorage.theme = 'light'
  }
}

function toggleTheme() {
  isDark.value = !isDark.value
  applyTheme()
}

function logout() {
  localStorage.removeItem('token')
  router.push({ name: 'Login' })
}

onMounted(() => applyTheme())
</script>
