// Centralized map & marker configuration
// Adjust via environment variables where useful.

export const MAP_INITIAL = {
  lat: Number(import.meta.env.VITE_MAP_INIT_LAT ?? 0),
  lon: Number(import.meta.env.VITE_MAP_INIT_LON ?? 0),
  zoom: Number(import.meta.env.VITE_MAP_INIT_ZOOM ?? 2)
}

export const MAP_MIN_ZOOM = Number(import.meta.env.VITE_MAP_MIN_ZOOM ?? 13)
export const TRACK_PADDING = Number(import.meta.env.VITE_TRACK_PADDING ?? 120)
export const MARKER_AREA_RADIUS = Number(import.meta.env.VITE_MARKER_RADIUS ?? 200) // meters

export const STATUS_COLORS = {
  on: import.meta.env.VITE_COLOR_ON || '#ef4444',
  off: import.meta.env.VITE_COLOR_OFF || '#2563eb'
}

export const ONLINE_NORMALIZERS = ['on','1','true']

export function isOnline(value) {
  const raw = (value ?? '').toString().toLowerCase()
  return ONLINE_NORMALIZERS.includes(raw)
}

export const TILE_URL = import.meta.env.VITE_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
