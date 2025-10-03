<template>
  <div class="min-h-[calc(100vh-56px)] p-3 sm:p-4 lg:p-6">
    <div class="mx-auto max-w-[1600px]">
      <div class="flex items-center justify-between mb-1">
        <h1 class="text-[22px] sm:text-2xl font-semibold">Map</h1>
        <p class="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400">Live lokasi alat</p>
      </div>
      <div id="map" class="h-[calc(100vh-56px-56px-16px)] bg-white dark:bg-slate-800 dark:border dark:border-slate-700 rounded-lg shadow"></div>
    </div>
  </div>
  <!-- 56px navbar height, ~56px header/padding, ~16px margins for safe fit -->
</template>

<script setup>
  import { ref, onMounted, onBeforeUnmount } from 'vue'
  import L from 'leaflet'
  import 'leaflet/dist/leaflet.css'
  import api from '../services/api'
  import { connectSocket, disconnectSocket } from '../services/socket'

  // Fix default icon paths for Leaflet when using bundlers
  delete L.Icon.Default.prototype._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
    iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
    shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
  })

  const mapRef = ref(null)
  let socket = null
  const liveMarkers = {}

  async function loadMarkers(map) {
    try {
      const res = await api.get('/dashboard')
      const lokasi = res.data.lokasiTerakhir || {}
      const markers = []
      for (const [id, loc] of Object.entries(lokasi)) {
        if (loc.latitude == null || loc.longitude == null) continue
        const marker = L.marker([loc.latitude, loc.longitude]).bindPopup(`<strong>${id}</strong><br/>Status: ${loc.status}`)
        marker.addTo(map)
        markers.push(marker)
      }
      if (markers.length) {
        const group = L.featureGroup(markers)
        map.fitBounds(group.getBounds().pad(0.2))
      }
    } catch (err) {
      console.error('Failed to load lokasi for map', err)
    }
  }

  function invalidateSizeSoon(map) {
    // invalidate size after next tick and on window resize
    setTimeout(() => map.invalidateSize(), 0)
    const handler = () => map.invalidateSize()
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }

  onMounted(() => {
    const map = L.map('map', { zoomControl: true }).setView([-6.2, 106.8], 12)
    L.control.scale({ imperial: false }).addTo(map)
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      crossOrigin: 'anonymous',
      maxZoom: 19,
      detectRetina: true
    })
    osm.addTo(map)
    loadMarkers(map)
    const off = invalidateSizeSoon(map)
    // connect socket if token is available
    const token = localStorage.getItem('token')
    if (token) {
      socket = connectSocket(token)
      socket.on('connect', () => console.log('Socket connected', socket.id))
      socket.on('connect_error', (err) => console.error('Socket connect_error', err.message))
      socket.on('disconnect', (reason) => console.warn('Socket disconnected', reason))
      socket.on('liveLocation', (data) => {
        try {
          const { alatId, latitude, longitude, status } = data
          // update or create marker
          if (liveMarkers[alatId]) {
            liveMarkers[alatId].setLatLng([latitude, longitude])
            liveMarkers[alatId].bindPopup(`<strong>${alatId}</strong><br/>Status: ${status}`)
          } else {
            const m = L.marker([latitude, longitude]).bindPopup(`<strong>${alatId}</strong><br/>Status: ${status}`)
            m.addTo(map)
            liveMarkers[alatId] = m
          }
        } catch (e) { console.error('socket liveLocation error', e) }
      })
    }
  })

  onBeforeUnmount(() => {
    disconnectSocket()
  })
</script>
