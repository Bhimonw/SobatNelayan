
<script setup>
import { useRoute } from 'vue-router'
import { ref, computed, onMounted } from 'vue'
import Sidebar from './components/Sidebar.vue'
import Navbar from './components/Navbar.vue'
const route = useRoute()
const sidebarOpen = ref(true)
function onToggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value
  // Force Leaflet map to recalculate size when layout changes
  window.dispatchEvent(new Event('resize'))
}
const isAuthedLayout = computed(() => route.matched.some(r => r.meta?.requiresAuth))

// Apply persisted theme early so login page also respects dark mode
onMounted(() => {
  try {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    const saved = localStorage.getItem('theme')
    const isDark = saved ? saved === 'dark' : prefersDark
    const root = document.documentElement
    if (isDark) root.classList.add('dark')
    else root.classList.remove('dark')
  } catch {}
})
</script>

<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
    <template v-if="isAuthedLayout">
      <Navbar @toggleSidebar="onToggleSidebar" />
      <div class="flex">
        <Sidebar v-if="sidebarOpen" />
        <main class="flex-1">
          <router-view />
        </main>
      </div>
    </template>
    <template v-else>
      <router-view />
    </template>
  </div>
</template>
