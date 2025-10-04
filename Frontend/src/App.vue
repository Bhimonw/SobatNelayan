
<script setup>
import { useRoute } from 'vue-router'
import { ref, computed } from 'vue'
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

// Dark mode removed: always light theme
</script>

<template>
  <div class="min-h-screen bg-slate-50 text-slate-900">
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
