import { io } from 'socket.io-client'

let socket = null

// Determine socket base URL: prefer explicit env; otherwise use current window origin in browser.
// Removed hardcoded 'http://localhost:3000' fallback to avoid accidental prod misconfiguration.
const SOCKET_URL = (() => {
  const explicit = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_BASE
  if (explicit) return explicit
  if (typeof window !== 'undefined' && window.location && window.location.origin) return window.location.origin
  throw new Error('Socket URL not configured. Set VITE_SOCKET_URL (or VITE_API_BASE) in environment.')
})()

export function connectSocket(initialToken) {
    if (socket) return socket
    // Always provide the freshest token via auth function
    socket = io(SOCKET_URL, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 10,
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
    publicSocket = io(SOCKET_URL + '/public', { transports: ['websocket'] })
    return publicSocket
}

export function disconnectPublicSocket() {
    if (!publicSocket) return
    publicSocket.disconnect()
    publicSocket = null
}
