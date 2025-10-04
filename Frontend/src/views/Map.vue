<template>
  <div class="min-h-[calc(100vh-56px)] p-3 sm:p-4 lg:p-6">
    <div class="mx-auto max-w-[1600px]">
      <div class="flex items-center justify-between mb-1">
        <h1 class="text-[22px] sm:text-2xl font-semibold">Map</h1>
        <p class="text-[11px] sm:text-xs text-slate-600">Live lokasi alat</p>
      </div>
      <div id="map" class="h-[calc(100vh-56px-56px-16px)] bg-white rounded-lg shadow"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import api from '../services/api'
import { connectSocket, disconnectSocket, connectPublicSocket, disconnectPublicSocket } from '../services/socket'
import { MAP_INITIAL, MAP_MIN_ZOOM, TRACK_PADDING, MARKER_AREA_RADIUS, STATUS_COLORS, isOnline, TILE_URL } from '../config/mapConfig'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
  iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
  shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
})

const mapRef = ref(null)
let socket = null
let publicSocket = null
const liveMarkers = {}
const currentOnFollowId = ref(null)

function trackViewportIfNeeded(map, lat, lon, forceCenter = false) {
  try {
    if (!map) return
    const projected = map.project([lat, lon])
    const size = map.getSize()
    const minX = TRACK_PADDING
    const minY = TRACK_PADDING
    const maxX = size.x - TRACK_PADDING
    const maxY = size.y - TRACK_PADDING
    if (forceCenter) {
      map.setView([lat, lon], map.getZoom())
      return
    }
    if (projected.x < minX || projected.x > maxX || projected.y < minY || projected.y > maxY) {
      map.panTo([lat, lon], { animate: true })
    }
  } catch { /* ignore */ }
}

async function loadMarkers(map) {
  try {
    const res = await api.get('/dashboard')
    const lokasi = res.data.lokasiTerakhir || {}
    const markers = []
    for (const [id, loc] of Object.entries(lokasi)) {
      if (loc.latitude == null || loc.longitude == null) continue
      const status = isOnline(loc.status) ? 'on' : 'off'
      const ts = loc.ts ?? loc.updatedAt ?? loc.lastSeen ?? loc.last_update ?? loc.timestamp ?? null
      const group = upsertMarker(id, Number(loc.latitude), Number(loc.longitude), status, ts, false)
      if (status === 'on' && !currentOnFollowId.value) currentOnFollowId.value = id
      markers.push(group)
    }
    if (markers.length) {
      if (markers.length === 1) {
        const m = markers[0]
        const latlng = m.inner.getLatLng()
        map.setView([latlng.lat, latlng.lng], 14)
      } else {
        let dbMostRecentOn = 0, dbMostRecentOnMarker = null
        let dbMostRecent = 0, dbMostRecentMarker = null
        for (const [id, loc] of Object.entries(lokasi)) {
          if (loc.latitude == null || loc.longitude == null) continue
            const ts = loc.ts ?? loc.updatedAt ?? loc.lastSeen ?? loc.last_update ?? loc.timestamp ?? null
            const tsNum = ts ? Number(ts) : 0
            const isOn = isOnline(loc.status)
            if (isOn && tsNum && tsNum > dbMostRecentOn) {
              dbMostRecentOn = tsNum
              dbMostRecentOnMarker = { lat: Number(loc.latitude), lon: Number(loc.longitude) }
            }
            if (tsNum && tsNum > dbMostRecent) {
              dbMostRecent = tsNum
              dbMostRecentMarker = { lat: Number(loc.latitude), lon: Number(loc.longitude) }
            }
        }
        if (dbMostRecentOnMarker && dbMostRecentOn > 0) {
          map.setView([dbMostRecentOnMarker.lat, dbMostRecentOnMarker.lon], 14)
        } else if (dbMostRecentMarker && dbMostRecent > 0) {
          map.setView([dbMostRecentMarker.lat, dbMostRecentMarker.lon], 14)
        } else {
          const group = L.featureGroup(markers)
          const bounds = group.getBounds().pad(0.2)
          map.fitBounds(bounds)
          setTimeout(() => {
            try { if (map.getZoom() < MAP_MIN_ZOOM) map.setView(bounds.getCenter(), MAP_MIN_ZOOM) } catch { /* ignore */ }
          }, 0)
        }
      }
      return
    }
    try {
      const fb = await api.get('/dashboard/firebase-nodes-public')
      const nodes = fb.data?.nodes || {}
      const fbMarkers = []
      for (const [id, info] of Object.entries(nodes)) {
        const lat = info.latitude ?? info.lat
        const lon = info.longitude ?? info.long ?? info.lng
        const status = isOnline(info.status) ? 'on' : 'off'
        if (lat == null || lon == null) continue
        const ts = info.ts ?? info.updatedAt ?? info.lastSeen ?? info.last_update ?? info.timestamp ?? null
        const grp = upsertMarker(id, Number(lat), Number(lon), status, ts, false)
        if (status === 'on' && !currentOnFollowId.value) currentOnFollowId.value = id
        if (grp) fbMarkers.push(grp)
      }
      if (fbMarkers.length) {
        if (fbMarkers.length === 1) {
          const m = fbMarkers[0]
          const latlng = m.inner.getLatLng()
          map.setView([latlng.lat, latlng.lng], 14)
        } else {
          let fbMostRecentOn = 0, fbMostRecentOnMarker = null
          let fbMostRecent = 0, fbMostRecentMarker = null
          for (const [id, info] of Object.entries(nodes)) {
            const lat = info.latitude ?? info.lat
            const lon = info.longitude ?? info.long ?? info.lng
            if (lat == null || lon == null) continue
            const ts = info.ts ?? info.updatedAt ?? info.lastSeen ?? info.last_update ?? info.timestamp ?? null
            const tsNum = ts ? Number(ts) : 0
            const isOn = isOnline(info.status)
            if (isOn && tsNum && tsNum > fbMostRecentOn) {
              fbMostRecentOn = tsNum
              fbMostRecentOnMarker = { lat: Number(lat), lon: Number(lon) }
            }
            if (tsNum && tsNum > fbMostRecent) {
              fbMostRecent = tsNum
              fbMostRecentMarker = { lat: Number(lat), lon: Number(lon) }
            }
          }
          if (fbMostRecentOnMarker && fbMostRecentOn > 0) {
            map.setView([fbMostRecentOnMarker.lat, fbMostRecentOnMarker.lon], 14)
          } else if (fbMostRecentMarker && fbMostRecent > 0) {
            map.setView([fbMostRecentMarker.lat, fbMostRecentMarker.lon], 14)
          } else {
            const group2 = L.featureGroup(fbMarkers)
            const bounds2 = group2.getBounds().pad(0.2)
            map.fitBounds(bounds2)
            setTimeout(() => {
              try { if (map.getZoom() < MAP_MIN_ZOOM) map.setView(bounds2.getCenter(), MAP_MIN_ZOOM) } catch { /* ignore */ }
            }, 0)
          }
        }
      }
    } catch { /* ignore */ }
  } catch (err) {
    console.error('Failed to load lokasi for map', err)
  }
}

function createStatusMarker(lat, lon, status, id, ts = null, followed = false) {
  const baseColor = status === 'on' ? STATUS_COLORS.on : STATUS_COLORS.off
  const dimFactor = status === 'on' ? 1 : 0.6
  const color = baseColor
  const outer = L.circle([lat, lon], {
    radius: MARKER_AREA_RADIUS,
    color,
    weight: followed ? 2 : 0,
    fillColor: color,
    fillOpacity: 0.12 * dimFactor,
    interactive: false
  })
  const svg = `\n      <svg width="28" height="40" viewBox="0 0 24 40" xmlns="http://www.w3.org/2000/svg">\n        <path d="M12 0C7.03 0 3 4.03 3 9c0 7.5 9 19 9 19s9-11.5 9-19c0-4.97-4.03-9-9-9zm0 12.5A3.5 3.5 0 1 1 12 5.5a3.5 3.5 0 0 1 0 7z" fill="${color}" stroke="#111" stroke-width="0.5" opacity="${dimFactor}"/>\n      </svg>\n    `
  const icon = L.divIcon({ className: 'custom-pin-icon', html: svg, iconSize: [28, 40], iconAnchor: [14, 40] })
  const inner = L.marker([lat, lon], { icon })
  let popupHtml = `<strong>${id}</strong><br/>Status: ${status}`
  if (ts) {
    let when = ts
    const n = Number(ts)
    if (!Number.isNaN(n)) when = new Date(n)
    else {
      const d = new Date(ts)
      if (!isNaN(d)) when = d
    }
    if (when instanceof Date && !isNaN(when)) {
      popupHtml += `<br/>Last seen: ${when.toLocaleString()}`
    } else {
      popupHtml += `<br/>Last seen: ${ts}`
    }
  }
  inner.bindPopup(popupHtml)
  const group = L.layerGroup([outer, inner])
  group.inner = inner
  group.meta = { id, latitude: lat, longitude: lon, status, ts }
  return group
}

function upsertMarker(id, lat, lon, status, ts = null, followed = false) {
  try {
    if (liveMarkers[id] && liveMarkers[id].group) {
      try { mapRef.value.removeLayer(liveMarkers[id].group) } catch { /* ignore */ }
    }
    const grp = createStatusMarker(lat, lon, status, id, ts, followed)
    grp.addTo(mapRef.value)
    liveMarkers[id] = { group: grp, meta: { latitude: lat, longitude: lon, status, ts } }
    return grp
  } catch (e) {
    console.error('upsertMarker error', e)
    return null
  }
}

function invalidateSizeSoon(map) {
  setTimeout(() => map.invalidateSize(), 0)
  const handler = () => map.invalidateSize()
  window.addEventListener('resize', handler)
  return () => window.removeEventListener('resize', handler)
}

onMounted(() => {
  const map = L.map('map', { zoomControl: true }).setView([MAP_INITIAL.lat, MAP_INITIAL.lon], MAP_INITIAL.zoom)
  mapRef.value = map
  L.control.scale({ imperial: false }).addTo(map)
  const osm = L.tileLayer(TILE_URL, {
    attribution: '&copy; OpenStreetMap contributors',
    crossOrigin: 'anonymous',
    maxZoom: 19,
    detectRetina: true
  })
  osm.addTo(map)
  const legend = L.control({ position: 'topright' })
  legend.onAdd = function () {
    const div = L.DomUtil.create('div', 'map-legend')
    div.innerHTML = `
        <div style="font-size:12px;line-height:1.2;color:#111;background:#fff;padding:8px;border-radius:6px;box-shadow:0 1px 4px rgba(0,0,0,0.2);">
          <div style="display:flex;align-items:center;margin-bottom:6px;"><svg width="16" height="28" viewBox="0 0 24 40" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C7.03 0 3 4.03 3 9c0 7.5 9 19 9 19s9-11.5 9-19c0-4.97-4.03-9-9-9zm0 12.5A3.5 3.5 0 1 1 12 5.5a3.5 3.5 0 0 1 0 7z" fill="${STATUS_COLORS.on}" stroke="#111" stroke-width="0.5"/></svg>&nbsp;<strong style="margin-left:6px">Online</strong></div>
          <div style="display:flex;align-items:center;margin-bottom:2px;"><svg width="16" height="28" viewBox="0 0 24 40" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C7.03 0 3 4.03 3 9c0 7.5 9 19 9 19s9-11.5 9-19c0-4.97-4.03-9-9-9zm0 12.5A3.5 3.5 0 1 1 12 5.5a3.5 3.5 0 0 1 0 7z" fill="${STATUS_COLORS.off}" stroke="#111" stroke-width="0.5" opacity="0.6"/></svg>&nbsp;<strong style="margin-left:6px">Offline</strong></div>
          <div style="font-size:11px;color:#444;margin-top:4px">Last seen = waktu terakhir data</div>
        </div>
      `
    return div
  }
  legend.addTo(map)
  let initialCentered = false
  loadMarkers(map).then(() => {
    try {
      if (!initialCentered) {
        let targetId = currentOnFollowId.value
        if (!targetId) {
          let bestTs = 0
          for (const [id, info] of Object.entries(liveMarkers)) {
            const meta = info.meta
            if (meta.status === 'on') {
              const tsNum = meta.ts ? Number(meta.ts) : 0
              if (tsNum >= bestTs) { bestTs = tsNum; targetId = id }
            }
          }
          if (!targetId) {
            const keys = Object.keys(liveMarkers)
            if (keys.length) targetId = keys[0]
          }
        }
        if (targetId && liveMarkers[targetId]) {
          const pos = liveMarkers[targetId].group.inner.getLatLng()
          map.setView([pos.lat, pos.lng], MAP_MIN_ZOOM)
          initialCentered = true
        }
      }
    } catch { /* ignore */ }
  })
  try {
    const buoyLat = Number(import.meta.env.VITE_BUOY_LAT || null)
    const buoyLon = Number(import.meta.env.VITE_BUOY_LON || null)
    const callNearest = async () => {
      try {
        const token = localStorage.getItem('token')
        const url = token ? '/dashboard/nearest' : '/dashboard/nearest-public'
        const q = (buoyLat && buoyLon) ? `?lat=${buoyLat}&lon=${buoyLon}` : ''
        const resp = await api.get(`${url}${q}`)
        const nearest = resp.data?.nearest
        if (nearest && nearest.latitude != null && nearest.longitude != null) {
          map.setView([nearest.latitude, nearest.longitude], MAP_MIN_ZOOM)
          const normalizedNearest = isOnline(nearest.status) ? 'on' : 'off'
          upsertMarker(nearest.alatId, Number(nearest.latitude), Number(nearest.longitude), normalizedNearest, nearest.timestamp || null, false)
          if (normalizedNearest === 'on' && !currentOnFollowId.value) currentOnFollowId.value = nearest.alatId
        }
      } catch { /* ignore */ }
    }
    if (!Number.isNaN(buoyLat) && !Number.isNaN(buoyLon)) callNearest()
  } catch { /* ignore */ }
  const off = invalidateSizeSoon(map)
  const token = localStorage.getItem('token')
  if (token) {
    socket = connectSocket(token)
    socket.on('liveLocation', (data) => {
      try {
        const { alatId, latitude, longitude, status, ts } = data
        const normalized = isOnline(status) ? 'on' : 'off'
        upsertMarker(alatId, Number(latitude), Number(longitude), normalized, ts, false)
        const mapInstance = mapRef.value
        if (normalized === 'on') {
          currentOnFollowId.value = alatId
        } else if (currentOnFollowId.value === alatId) {
          let replacement = null
          for (const [id, info] of Object.entries(liveMarkers)) {
            if (id === alatId) continue
            if (info.meta.status === 'on') { replacement = id; break }
          }
          currentOnFollowId.value = replacement
        }
        if (mapInstance && latitude != null && longitude != null && currentOnFollowId.value === alatId) {
          trackViewportIfNeeded(mapInstance, Number(latitude), Number(longitude), false)
        }
      } catch (e) { console.error('socket liveLocation error', e) }
    })
  } else {
    try {
      publicSocket = connectPublicSocket()
      publicSocket.on('liveLocation', (data) => {
        try {
          const { alatId, latitude, longitude, status, ts } = data
          const normalized = isOnline(status) ? 'on' : 'off'
          upsertMarker(alatId, Number(latitude), Number(longitude), normalized, ts, false)
          const mapInstance = mapRef.value
          if (normalized === 'on') {
            currentOnFollowId.value = alatId
          } else if (currentOnFollowId.value === alatId) {
            let replacement = null
            for (const [id, info] of Object.entries(liveMarkers)) {
              if (id === alatId) continue
              if (info.meta.status === 'on') { replacement = id; break }
            }
            currentOnFollowId.value = replacement
          }
          if (mapInstance && latitude != null && longitude != null && currentOnFollowId.value === alatId) {
            trackViewportIfNeeded(mapInstance, Number(latitude), Number(longitude), false)
          }
        } catch (e) { console.error('public socket liveLocation error', e) }
      })
    } catch (e) { console.warn('Could not connect to public socket', e) }
  }
})

onBeforeUnmount(() => {
  try { disconnectSocket() } catch { /* ignore */ }
  try { disconnectPublicSocket() } catch { /* ignore */ }
})
</script>
