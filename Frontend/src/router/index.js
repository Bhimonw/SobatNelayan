import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from '../views/Dashboard.vue'
import MapView from '../views/Map.vue'
import UserView from '../views/User.vue'
import Login from '../components/Login.vue'

const routes = [
    { path: '/', name: 'Home', component: Login },
    { path: '/login', name: 'Login', component: Login },
    { path: '/dashboard', name: 'Dashboard', component: Dashboard, meta: { requiresAuth: true } },
    { path: '/map', name: 'Map', component: MapView, meta: { requiresAuth: true } },
    { path: '/user', name: 'User', component: UserView, meta: { requiresAuth: true } },
]

const router = createRouter({
    history: createWebHistory(),
    routes,
})

// Global auth guard
router.beforeEach((to, from, next) => {
    const requiresAuth = to.matched.some(r => r.meta?.requiresAuth)
    const token = localStorage.getItem('token')
    if (requiresAuth && !token) {
        return next({ name: 'Login' })
    }
    next()
})

export default router
