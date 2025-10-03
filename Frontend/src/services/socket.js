import { io } from 'socket.io-client'

let socket = null

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_BASE || 'http://localhost:3000'

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
