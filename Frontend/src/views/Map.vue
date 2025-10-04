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
  import { connectSocket, disconnectSocket, connectPublicSocket, disconnectPublicSocket } from '../services/socket'

  // Fix default icon paths for Leaflet when using bundlers
  delete L.Icon.Default.prototype._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
    iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
    shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
  })

  const mapRef = ref(null)
  let socket = null
  let publicSocket = null
  const liveMarkers = {} // id -> { group, meta }
  const followId = ref(null)
  const autoFollow = ref(false)

  function updateLegendDisplay() {
    try {
      const el = document.getElementById('follow-status')
      if (el) el.textContent = followId.value ? `Following: ${followId.value}` : 'Not following'
      const cb = document.getElementById('auto-follow')
      if (cb) cb.checked = !!autoFollow.value
    } catch (e) { /* ignore */ }
  }

  function setFollow(id) {
    followId.value = id
    // refresh visuals for previous and current markers
    for (const k of Object.keys(liveMarkers)) {
      const entry = liveMarkers[k]
      if (!entry) continue
      const isFollowed = k === followId.value
      // recreate marker to update ring/visual
      const { latitude, longitude, status, ts } = entry.meta
      upsertMarker(k, latitude, longitude, status, ts, isFollowed)
    }
    updateLegendDisplay()
  }

  function clearFollow() {
    followId.value = null
    for (const k of Object.keys(liveMarkers)) {
      const entry = liveMarkers[k]
      if (!entry) continue
      const { latitude, longitude, status, ts } = entry.meta
      upsertMarker(k, latitude, longitude, status, ts, false)
    }
    updateLegendDisplay()
  }

  async function loadMarkers(map) {
    try {
      const res = await api.get('/dashboard')
      const lokasi = res.data.lokasiTerakhir || {}
      const markers = []
          for (const [id, loc] of Object.entries(lokasi)) {
            if (loc.latitude == null || loc.longitude == null) continue
            // normalize status values so variations like 'ON', '1', 'true' are handled
            const rawStatus = (loc.status ?? '').toString().toLowerCase()
            const status = ['on', '1', 'true'].includes(rawStatus) ? 'on' : 'off'
            // try to extract timestamp if backend provided it (ms since epoch or ISO)
            const ts = loc.ts ?? loc.updatedAt ?? loc.lastSeen ?? loc.last_update ?? loc.timestamp ?? null
            const group = upsertMarker(id, Number(loc.latitude), Number(loc.longitude), status, ts, id === followId.value)
            markers.push(group)
          }
      if (markers.length) {
        // if auto-follow enabled and no follow chosen, pick best candidate
        try {
          if (autoFollow.value && !followId.value) {
            // prefer most recent online
            let best = null
            for (const g of markers) {
              const id = g.meta?.id
              if (!id) continue
              const meta = liveMarkers[id]?.meta
              const isOn = (meta?.status ?? '').toString().toLowerCase()
              if (isOn === 'on') { best = id; break }
            }
            if (!best && markers.length) best = markers[0]?.meta?.id
            if (best) setFollow(best)
          }
        } catch (e) { /* ignore */ }
        // If only one alat, center map directly to it so user sees it clearly.
        if (markers.length === 1) {
          const m = markers[0]
          const latlng = m.inner.getLatLng()
          map.setView([latlng.lat, latlng.lng], 14)
        } else {
          // Prefer centering on an ONLINE device (most recent), then most-recent overall, then first marker
          let dbMostRecentOn = 0
          let dbMostRecentOnMarker = null
          let dbMostRecent = 0
          let dbMostRecentMarker = null
          for (const [id, loc] of Object.entries(lokasi)) {
            if (loc.latitude == null || loc.longitude == null) continue
            const ts = loc.ts ?? loc.updatedAt ?? loc.lastSeen ?? loc.last_update ?? loc.timestamp ?? null
            const tsNum = ts ? Number(ts) : 0
            const rawStatus = (loc.status ?? '').toString().toLowerCase()
            const isOn = ['on', '1', 'true'].includes(rawStatus)
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
            // enforce a minimum zoom so map doesn't stay too far out on small clusters
            setTimeout(() => {
              try {
                const z = map.getZoom()
                const minZoom = 13
                if (z < minZoom) map.setView(bounds.getCenter(), minZoom)
              } catch (e) { /* ignore */ }
            }, 0)
          }
        }
        return
      }
      // If no markers from dashboard (e.g., unauthenticated or no DB rows), try public Firebase nodes
      try {
        const fb = await api.get('/dashboard/firebase-nodes-public')
        const nodes = fb.data?.nodes || {}
        const fbMarkers = []
        for (const [id, info] of Object.entries(nodes)) {
          const lat = info.latitude ?? info.lat
          const lon = info.longitude ?? info.long ?? info.lng
          const rawStatus = (info.status ?? '').toString().toLowerCase()
          const status = ['on', '1', 'true'].includes(rawStatus) ? 'on' : 'off'
          if (lat == null || lon == null) continue
          const ts = info.ts ?? info.updatedAt ?? info.lastSeen ?? info.last_update ?? info.timestamp ?? null
          const grp = upsertMarker(id, Number(lat), Number(lon), status, ts, id === followId.value)
          if (grp) fbMarkers.push(grp)
        }
        if (fbMarkers.length) {
          try {
            if (autoFollow.value && !followId.value) {
              let best = null
              for (const g of fbMarkers) {
                const id = g.meta?.id
                if (!id) continue
                const meta = liveMarkers[id]?.meta
                const isOn = (meta?.status ?? '').toString().toLowerCase()
                if (isOn === 'on') { best = id; break }
              }
              if (!best && fbMarkers.length) best = fbMarkers[0]?.meta?.id
              if (best) setFollow(best)
            }
          } catch (e) { /* ignore */ }
          if (fbMarkers.length === 1) {
            const m = fbMarkers[0]
            const latlng = m.inner.getLatLng()
            map.setView([latlng.lat, latlng.lng], 14)
          } else {
            // Prefer online nodes first
            let fbMostRecentOn = 0
            let fbMostRecentOnMarker = null
            let fbMostRecent = 0
            let fbMostRecentMarker = null
            for (const [id, info] of Object.entries(nodes)) {
              const lat = info.latitude ?? info.lat
              const lon = info.longitude ?? info.long ?? info.lng
              if (lat == null || lon == null) continue
              const ts = info.ts ?? info.updatedAt ?? info.lastSeen ?? info.last_update ?? info.timestamp ?? null
              const tsNum = ts ? Number(ts) : 0
              const rawStatus = (info.status ?? '').toString().toLowerCase()
              const isOn = ['on', '1', 'true'].includes(rawStatus)
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
                try {
                  const z = map.getZoom()
                  const minZoom = 13
                  if (z < minZoom) map.setView(bounds2.getCenter(), minZoom)
                } catch (e) { /* ignore */ }
              }, 0)
            }
          }
        }
      } catch (e) {
        // ignore firebase fallback errors
      }
    } catch (err) {
      console.error('Failed to load lokasi for map', err)
    }
  }

  // helper: create a visible location representation
  // returns a LayerGroup containing an outer area circle and an inner center marker
  // accepts optional ts (timestamp) to show "last seen" info
  function createStatusMarker(lat, lon, status, id, ts = null, followed = false) {
    // status 'on' -> red, otherwise default blue
    const baseColor = status === 'on' ? '#ef4444' : '#2563eb' // tailwind red-500 / blue-600
    // dim offline markers for clarity
    const dimFactor = status === 'on' ? 1 : 0.6
    const color = baseColor

    // outer area (in meters). Use a sensible default; you can expose this via env or API later.
    const areaRadius = 200 // meters

    const outer = L.circle([lat, lon], {
      radius: areaRadius,
      color: color,
      weight: followed ? 2 : 0,
      fillColor: color,
      fillOpacity: 0.12 * dimFactor,
      interactive: false
    })

    // choose SVG: pin for online, arrow for offline
    let svg = ''
    if (status === 'off') {
      // blue arrow (downwards) for offline devices — clear visual cue
      const arrowColor = '#2563eb'
      svg = `
        <svg width="28" height="28" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2 L20 14 H14 V22 H10 V14 H4 L12 2 Z" fill="${arrowColor}" stroke="#0b1220" stroke-width="0.5" opacity="${dimFactor}"/>
        </svg>
      `
    } else {
      // pin for online
      svg = `
        <svg width="28" height="40" viewBox="0 0 24 40" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 0C7.03 0 3 4.03 3 9c0 7.5 9 19 9 19s9-11.5 9-19c0-4.97-4.03-9-9-9zm0 12.5A3.5 3.5 0 1 1 12 5.5a3.5 3.5 0 0 1 0 7z" fill="${color}" stroke="#111" stroke-width="0.5" opacity="${dimFactor}"/>
        </svg>
      `
    }

    const icon = L.divIcon({
      className: 'custom-pin-icon',
      html: svg,
      iconSize: [28, 40],
      iconAnchor: [14, 40]
    })

    const inner = L.marker([lat, lon], { icon })
    // build popup with optional last-seen info
    let popupHtml = `<strong>${id}</strong><br/>Status: ${status}`
    if (ts) {
      let when = ts
      // try to parse numeric ms or ISO
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

  // upsert marker: create or update marker group and store meta
  function upsertMarker(id, lat, lon, status, ts = null, followed = false) {
    try {
      // remove old
      if (liveMarkers[id] && liveMarkers[id].group) {
        try { mapRef.value.removeLayer(liveMarkers[id].group) } catch (e) { /* ignore */ }
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
    // invalidate size after next tick and on window resize
    setTimeout(() => map.invalidateSize(), 0)
    const handler = () => map.invalidateSize()
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }

  onMounted(() => {
    const map = L.map('map', { zoomControl: true }).setView([-6.2, 106.8], 12)
    // expose the map instance so other handlers (socket, etc.) can access it
    mapRef.value = map
    L.control.scale({ imperial: false }).addTo(map)
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      crossOrigin: 'anonymous',
      maxZoom: 19,
      detectRetina: true
    })
    osm.addTo(map)
    // add a legend control to the map
    const legend = L.control({ position: 'topright' })
    legend.onAdd = function () {
      const div = L.DomUtil.create('div', 'map-legend')
      div.innerHTML = `
        <div style="font-size:12px;line-height:1.2;color:#111;background:#fff;padding:8px;border-radius:6px;box-shadow:0 1px 4px rgba(0,0,0,0.2);">
          <div style="display:flex;align-items:center;margin-bottom:6px;"><svg width="16" height="28" viewBox="0 0 24 40" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C7.03 0 3 4.03 3 9c0 7.5 9 19 9 19s9-11.5 9-19c0-4.97-4.03-9-9-9zm0 12.5A3.5 3.5 0 1 1 12 5.5a3.5 3.5 0 0 1 0 7z" fill="#ef4444" stroke="#111" stroke-width="0.5"/></svg>&nbsp;<strong style="margin-left:6px">Online</strong></div>
          <div style="display:flex;align-items:center;margin-bottom:6px;"><svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2 L20 14 H14 V22 H10 V14 H4 L12 2 Z" fill="#2563eb" stroke="#0b1220" stroke-width="0.5" opacity="0.6"/></svg>&nbsp;<strong style="margin-left:6px">Offline</strong></div>
          <div style="font-size:11px;color:#444;margin-top:4px">Last seen shows time of the last update</div>
          <hr style="margin:8px 0" />
          <div style="font-size:12px;margin-top:6px;display:flex;flex-direction:column;gap:6px">
            <div id="follow-status">Not following</div>
            <label style="font-size:12px;display:flex;align-items:center;gap:8px"><input id="auto-follow" type="checkbox" /> Auto-follow live updates</label>
            <div style="display:flex;gap:6px">
              <button id="follow-first" style="font-size:12px;padding:4px 8px;border-radius:4px;background:#1f2937;color:#fff;border:none">Follow first</button>
              <button id="clear-follow" style="font-size:12px;padding:4px 8px;border-radius:4px;background:#ef4444;color:#fff;border:none">Clear</button>
            </div>
          </div>
        </div>
      `
      return div
    }
    legend.addTo(map)
    // attach legend interactions
    setTimeout(() => {
      try {
        const btn = document.getElementById('follow-first')
        const clr = document.getElementById('clear-follow')
        const cb = document.getElementById('auto-follow')
        if (btn) btn.addEventListener('click', () => {
          // pick first liveMarkers key
          const keys = Object.keys(liveMarkers)
          if (keys.length) setFollow(keys[0])
        })
        if (clr) clr.addEventListener('click', () => clearFollow())
        if (cb) cb.addEventListener('change', (e) => { autoFollow.value = !!e.target.checked; updateLegendDisplay() })
        updateLegendDisplay()
      } catch (e) { /* ignore */ }
    }, 0)
    loadMarkers(map)
    // If buoy coordinates are configured in environment, ask backend for nearest alat and center map
    try {
      const buoyLat = Number(import.meta.env.VITE_BUOY_LAT || null)
      const buoyLon = Number(import.meta.env.VITE_BUOY_LON || null)
      const callNearest = async () => {
        try {
          // Prefer auth endpoint if token present, otherwise use public dev endpoint
          const token = localStorage.getItem('token')
          const url = token ? '/dashboard/nearest' : '/dashboard/nearest-public'
          const q = (buoyLat && buoyLon) ? `?lat=${buoyLat}&lon=${buoyLon}` : ''
          const resp = await api.get(`${url}${q}`)
          const nearest = resp.data?.nearest
          if (nearest && nearest.latitude != null && nearest.longitude != null) {
            map.setView([nearest.latitude, nearest.longitude], 14)
            // ensure marker exists/upserted
            upsertMarker(nearest.alatId, Number(nearest.latitude), Number(nearest.longitude), nearest.status || 'off', nearest.timestamp || null, nearest.alatId === followId.value)
            // optionally set follow to nearest
            if (autoFollow.value) setFollow(nearest.alatId)
          }
        } catch (e) {
          // ignore (may be dev or missing endpoint)
        }
      }
      if (!Number.isNaN(buoyLat) && !Number.isNaN(buoyLon)) callNearest()
    } catch (e) { /* ignore */ }
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
          const { alatId, latitude, longitude, status, ts } = data
          // update or create marker
          const rawStatus = (status ?? '').toString().toLowerCase()
          const normalized = ['on', '1', 'true'].includes(rawStatus) ? 'on' : 'off'
          // upsert the marker
          upsertMarker(alatId, Number(latitude), Number(longitude), normalized, ts, alatId === followId.value)
          // follow logic: if autoFollow is true or this alat is being followed, center on it
          try {
            const mapInstance = mapRef.value
            if (mapInstance && latitude != null && longitude != null) {
              if (autoFollow.value || followId.value === alatId) {
                mapInstance.setView([Number(latitude), Number(longitude)], 14)
              }
            }
          } catch (e) { /* ignore */ }
        } catch (e) { console.error('socket liveLocation error', e) }
      })
    } else {
      // try public (no-auth) socket namespace so map viewers can receive live updates
      try {
        publicSocket = connectPublicSocket()
        publicSocket.on('connect', () => console.log('Public socket connected', publicSocket.id))
        publicSocket.on('connect_error', (err) => console.error('Public socket connect_error', err.message))
        publicSocket.on('disconnect', (reason) => console.warn('Public socket disconnected', reason))
        publicSocket.on('liveLocation', (data) => {
          try {
            const { alatId, latitude, longitude, status, ts } = data
            const rawStatus = (status ?? '').toString().toLowerCase()
            const normalized = ['on', '1', 'true'].includes(rawStatus) ? 'on' : 'off'
            upsertMarker(alatId, Number(latitude), Number(longitude), normalized, ts, alatId === followId.value)
            try {
              const mapInstance = mapRef.value
              if (mapInstance && latitude != null && longitude != null) {
                if (autoFollow.value || followId.value === alatId) {
                  mapInstance.setView([Number(latitude), Number(longitude)], 14)
                }
              }
            } catch (e) { /* ignore */ }
          } catch (e) { console.error('public socket liveLocation error', e) }
        })
      } catch (e) { console.warn('Could not connect to public socket', e) }
    }
  })

  onBeforeUnmount(() => {
    try { disconnectSocket() } catch (e) { /* ignore */ }
    try { disconnectPublicSocket() } catch (e) { /* ignore */ }
  })
</script>
