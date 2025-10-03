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
        const marker = createStatusMarker(loc.latitude, loc.longitude, loc.status, id)
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

  // helper: create a visible location representation
  // returns a LayerGroup containing an outer area circle and an inner center marker
  function createStatusMarker(lat, lon, status, id) {
    // status 'on' -> red, otherwise default blue
    const color = status === 'on' ? '#ef4444' : '#2563eb' // tailwind red-500 / blue-600

    // outer area (in meters). Use a sensible default; you can expose this via env or API later.
    const areaRadius = 200 // meters

    const outer = L.circle([lat, lon], {
      radius: areaRadius,
      color: color,
      weight: 0,
      fillColor: color,
      fillOpacity: 0.12,
      interactive: false
    })

    // create a pin-shaped SVG as DivIcon so it scales cleanly and can be styled via fill
    const svg = `
      <svg width="28" height="40" viewBox="0 0 24 40" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 0C7.03 0 3 4.03 3 9c0 7.5 9 19 9 19s9-11.5 9-19c0-4.97-4.03-9-9-9zm0 12.5A3.5 3.5 0 1 1 12 5.5a3.5 3.5 0 0 1 0 7z" fill="${color}" stroke="#111" stroke-width="0.5"/>
      </svg>
    `

    const icon = L.divIcon({
      className: 'custom-pin-icon',
      html: svg,
      iconSize: [28, 40],
      iconAnchor: [14, 40]
    })

    const inner = L.marker([lat, lon], { icon })
    inner.bindPopup(`<strong>${id}</strong><br/>Status: ${status}`)

    const group = L.layerGroup([outer, inner])
    group.inner = inner
    return group
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
            // remove old group and add updated group
            try { map.removeLayer(liveMarkers[alatId]) } catch (e) { /* ignore */ }
            const mNew = createStatusMarker(latitude, longitude, status, alatId)
            mNew.addTo(map)
            liveMarkers[alatId] = mNew
          } else {
            const m = createStatusMarker(latitude, longitude, status, alatId)
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
