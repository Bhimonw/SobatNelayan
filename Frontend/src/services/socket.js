import { io } from 'socket.io-client'

let socket = null

// Determine socket base URL: prefer explicit VITE_SOCKET_URL; else derive from API base or window origin.
// Accept forms like: https://app.example.com OR https://app.example.com/api (we'll strip trailing /api for socket use if present).
function deriveSocketBase() {
    let raw = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_BASE || ''
    if (!raw && typeof window !== 'undefined' && window.location?.origin) raw = window.location.origin
    if (!raw) throw new Error('Socket URL not configured. Set VITE_SOCKET_URL or VITE_API_BASE.')
    // Strip trailing '/api' if present (common pattern when API_BASE is origin + /api)
    if (/\/api\/?$/.test(raw)) raw = raw.replace(/\/api\/?$/, '')
    return raw
}
const SOCKET_BASE = deriveSocketBase()
// Optional custom path; must match backend env.SOCKET_PATH
const SOCKET_PATH = import.meta.env.VITE_SOCKET_PATH || '/socket.io'

export function connectSocket(initialToken) {
    if (socket) return socket
    socket = io(SOCKET_BASE, {
        path: SOCKET_PATH,
        transports: ['websocket', 'polling'], // allow fallback if websocket upgrade blocked
        reconnection: true,
        reconnectionAttempts: 15,
        reconnectionDelay: 1000,
        auth: (cb) => {
            try {
                const t = localStorage.getItem('token') || initialToken
                cb({ token: t })
            } catch {
                cb({ token: initialToken })
            }
        }
    })
    socket.on('connect_error', (err) => {
        if (err && (err.message?.includes('Authentication') || err.message?.includes('400'))) {
            console.warn('[socket] connect_error', err.message)
        }
    })
    socket.on('error', (e) => console.warn('[socket] error', e && e.message))
    socket.on('reconnect_attempt', (n) => { /* verbose trace for debugging */ if (n === 1 || n % 5 === 0) console.debug('[socket] reconnect attempt', n) })
    return socket
}

export function disconnectSocket() {
    if (!socket) return
    socket.disconnect()
    socket = null
}

// public (no-auth) socket connection to '/public' namespace
let publicSocket = null
export function connectPublicSocket() {
    if (publicSocket) return publicSocket
    publicSocket = io(SOCKET_BASE + '/public', {
        path: SOCKET_PATH,
        transports: ['websocket', 'polling']
    })
    publicSocket.on('connect_error', (err) => {
        console.warn('[public socket] connect_error', err && err.message)
    })
    publicSocket.on('error', (e) => console.warn('[public socket] error', e && e.message))
    return publicSocket
}

export function disconnectPublicSocket() {
    if (!publicSocket) return
    publicSocket.disconnect()
    publicSocket = null
}
