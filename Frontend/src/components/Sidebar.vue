<template>
  <aside class="w-64 shrink-0 bg-white/90 backdrop-blur border-r h-[calc(100vh-56px)] sticky top-14 p-3 flex flex-col justify-between">
    <nav class="space-y-1.5 text-[14px] sm:text-[15px]">
      <RouterLink
    to="/dashboard"
  class="flex items-center gap-2 py-2.5 px-3 rounded-md hover:bg-slate-100"
    :class="isActive('/dashboard') ? 'bg-slate-100 font-medium' : ''"
      >
        <span class="inline-block w-4 h-4 rounded-sm bg-blue-500/20 border border-blue-500/40"></span>
        <span>Dashboard</span>
      </RouterLink>
      <RouterLink
    to="/map"
  class="flex items-center gap-2 py-2.5 px-3 rounded-md hover:bg-slate-100"
    :class="isActive('/map') ? 'bg-slate-100 font-medium' : ''"
      >
        <span class="inline-block w-4 h-4 rounded-sm bg-emerald-500/20 border border-emerald-500/40"></span>
        <span>Map</span>
      </RouterLink>
    </nav>

  <div class="mt-4 border-t pt-3">
      <RouterLink to="/user" class="flex items-center gap-3 p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800">
  <div class="h-9 w-9 rounded-full bg-slate-200 grid place-items-center text-slate-600 text-sm font-semibold">
          {{ (user?.name || user?.username || '?').slice(0,1).toUpperCase() }}
        </div>
        <div class="leading-tight truncate">
          <div class="text-[14px] sm:text-[15px] font-medium truncate">{{ user?.name || user?.username || 'User' }}</div>
          <div class="text-[11px] text-slate-500 truncate">@{{ user?.username }}</div>
        </div>
      </RouterLink>
    </div>
  </aside>
  
</template>

<script setup>
import { useRoute, RouterLink } from 'vue-router'
import { ref, onMounted } from 'vue'
import api from '../services/api'

const route = useRoute()
const isActive = (path) => route.path === path
const user = ref(null)

async function loadUser() {
  try {
    const res = await api.get('/auth/me')
    user.value = res.data
  } catch (e) {
    // ignore if unauthorized
    console.warn('Failed to load user', e?.response?.status)
  }
}

onMounted(loadUser)
</script>
