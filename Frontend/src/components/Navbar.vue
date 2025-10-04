<template>
  <header
  class="sticky top-0 z-40 border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/80"
  >
  <div class="mx-auto max-w-[1800px] px-2 sm:px-4 lg:px-6 h-14 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <button
          @click="$emit('toggleSidebar')"
          class="inline-flex items-center justify-center rounded-md border px-2 py-1 text-slate-700 hover:bg-slate-50"
          aria-label="Toggle sidebar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M3 5h14a1 1 0 100-2H3a1 1 0 100 2zm14 4H3a1 1 0 000 2h14a1 1 0 100-2zm0 6H3a1 1 0 000 2h14a1 1 0 100-2z" clip-rule="evenodd" />
          </svg>
        </button>
        <div class="h-9 w-9 rounded-md overflow-hidden flex items-center justify-center">
          <img src="/Logo.svg" alt="Sobat Nelayan Logo" class="h-9 w-9 object-contain" />
        </div>
        <div class="leading-tight">
          <h1 class="text-base sm:text-lg font-semibold text-slate-800 leading-tight">Sobat Nelayan</h1>
          <p class="text-[12px] sm:text-[13px] text-slate-500">Monitoring alat & lokasi</p>
        </div>
      </div>

      <div class="flex items-center gap-2">

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
import { useRouter } from 'vue-router'
defineEmits(['toggleSidebar'])
const router = useRouter()
function logout() {
  localStorage.removeItem('token')
  router.push({ name: 'Login' })
}
</script>
