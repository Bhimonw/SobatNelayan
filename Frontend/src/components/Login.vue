<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-blue-300 to-blue-600 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 px-4">
    <div class="w-full max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
      <!-- Illustration / branding column (desktop only) -->
      <div class="hidden md:flex flex-col items-center justify-center p-6">
        <div class="w-full max-w-md text-white">
          <!-- Simple wave + boat illustration -->
          <svg viewBox="0 0 600 400" class="w-full h-auto drop-shadow-lg mb-6">
            <defs>
              <linearGradient id="g1" x1="0" x2="1">
                <stop offset="0%" stop-color="#60a5fa" />
                <stop offset="100%" stop-color="#3b82f6" />
              </linearGradient>
            </defs>
            <rect width="600" height="300" rx="24" fill="url(#g1)" />
            <g transform="translate(60,120)">
              <path d="M0 60 C60 20, 120 20, 180 60 S300 100, 360 60 S480 20, 540 60" fill="#93c5fd" opacity="0.7" />
              <g transform="translate(200, -10)">
                <ellipse cx="40" cy="80" rx="40" ry="12" fill="#1e3a8a" opacity="0.9" />
                <path d="M10 60 L40 20 L70 60 Z" fill="#f8fafc" />
              </g>
            </g>
          </svg>
          <h3 class="text-2xl font-bold mb-2">Dashboard Statistik & Map</h3>
          <p class="text-sm opacity-90">Website monitoring dan live map pelampung pintar</p>
        </div>
      </div>

      <!-- Form column -->
    <div class="flex items-center justify-center">
  <div class="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-blue-100 dark:border-slate-800 p-8 animate-fadein">
          <div class="flex items-center gap-3 mb-6">
            <div class="bg-blue-100 p-2 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-blue-600" viewBox="0 0 24 24" fill="currentColor"><path d="M2.25 19.5l1.591-7.157A2.25 2.25 0 016.05 10.5h11.9a2.25 2.25 0 012.209 1.843L21.75 19.5M2.25 19.5h19.5"/></svg>
            </div>
            <div>
              <h2 class="text-xl font-semibold text-blue-700 dark:text-blue-300">Sobat Nelayan</h2>
              <p class="text-xs text-blue-500 dark:text-slate-400">Masuk untuk melihat dashboard dan map</p>
            </div>
          </div>

          <form @submit.prevent="handleLogin" class="space-y-4" aria-busy="false">
            <div>
              <label for="username" class="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Username</label>
              <input id="username" v-model="username" aria-label="username" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none shadow-sm bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 placeholder:text-slate-400" placeholder="username" />
              <p v-if="formErrors.username" class="text-red-500 text-xs mt-1">{{ formErrors.username }}</p>
            </div>

            <div>
              <label for="password" class="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Password</label>
              <div class="relative">
                <input :type="showPassword ? 'text' : 'password'" id="password" v-model="password" aria-label="password" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none shadow-sm bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 placeholder:text-slate-400" placeholder="password" />
                <button type="button" @click="showPassword = !showPassword" class="absolute right-2 top-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300" :aria-pressed="showPassword" :aria-label="showPasswordLabel">
                  {{ showPassword ? 'Hide' : 'Show' }}
                </button>
              </div>
              <p v-if="formErrors.password" class="text-red-500 text-xs mt-1">{{ formErrors.password }}</p>
            </div>

            <div class="flex items-center justify-start gap-2 text-sm">
              <label class="inline-flex items-center gap-2">
                <input type="checkbox" v-model="rememberMe" class="h-4 w-4 text-blue-600" />
                <span class="text-slate-600 dark:text-slate-300">Remember me</span>
              </label>
            </div>

            <div>
              <button :disabled="loading" type="submit" class="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white py-2 rounded-lg font-semibold shadow transition-transform hover:shadow-lg disabled:opacity-60">
                <span v-if="loading" class="loader w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true"></span>
                <span>{{ loading ? 'Masuk...' : 'Masuk' }}</span>
              </button>
            </div>

            <transition name="fade">
              <p v-if="error" class="text-red-500 text-sm text-center">{{ error }}</p>
            </transition>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../services/api'

const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const showPassword = ref(false)
const rememberMe = ref(false)

const formErrors = reactive({ username: '', password: '' })

const showPasswordLabel = computed(() => (showPassword.value ? 'Hide password' : 'Show password'))

function validate() {
  formErrors.username = ''
  formErrors.password = ''
  let ok = true
  if (!username.value) { formErrors.username = 'Username wajib diisi'; ok = false }
  if (!password.value) { formErrors.password = 'Password wajib diisi'; ok = false }
  return ok
}

const router = useRouter()

const handleLogin = async () => {
  error.value = ''
  if (!validate()) return
  loading.value = true
  try {
    const response = await api.post('/auth/login', {
      username: username.value,
      password: password.value
    })
    localStorage.setItem('token', response.data.token)
    if (rememberMe.value) {
      try {
        localStorage.setItem('rememberUser', username.value)
        localStorage.setItem('rememberMe', '1')
      } catch {}
    } else {
      try {
        localStorage.removeItem('rememberUser')
        localStorage.removeItem('rememberMe')
      } catch {}
    }
    // Persist current theme if user toggled it previously
    try {
      const isDark = document.documentElement.classList.contains('dark')
      localStorage.setItem('theme', isDark ? 'dark' : 'light')
    } catch {}
    // redirect setelah sukses via router
    router.push({ name: 'Dashboard' })
  } catch (e) {
    error.value = e?.response?.data?.message || 'Login gagal, cek username/password.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  try {
    const savedUser = localStorage.getItem('rememberUser') || localStorage.getItem('remember') || ''
    if (savedUser) {
      username.value = savedUser
      rememberMe.value = (localStorage.getItem('rememberMe') === '1') || true
    } else {
      rememberMe.value = (localStorage.getItem('rememberMe') === '1')
    }
  } catch {}
})
</script>

<style>
@keyframes fadein {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fadein {
  animation: fadein 0.7s cubic-bezier(.4,0,.2,1);
}

.loader {
  border-top-color: transparent;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity .2s
}
.fade-enter-from, .fade-leave-to {
  opacity: 0
}

@media (min-width: 768px) {
  /* removed hover scale; keep subtle transform via shadow on hover */
}

.rounded-lg:focus {
  /* smooth focus transition for inputs */
  transition: box-shadow 0.15s ease, border-color 0.15s ease;
}
</style>
