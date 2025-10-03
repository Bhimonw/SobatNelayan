<template>
  <div class="min-h-[calc(100vh-56px)] p-4">
    <div class="mx-auto max-w-2xl">
      <h1 class="text-2xl font-semibold mb-2">Profil</h1>
      <p class="text-sm text-slate-600 dark:text-slate-400 mb-4">Lihat dan perbarui informasi akun Anda.</p>

      <div v-if="loading" class="text-sm text-slate-600 dark:text-slate-400">Memuat...</div>
      <div v-else-if="!user" class="text-sm text-red-600 dark:text-red-400">Tidak dapat memuat data pengguna.</div>
      <div v-else class="grid grid-cols-1 gap-6">
        <!-- Card: Info User -->
        <div class="bg-white dark:bg-slate-800 dark:border dark:border-slate-700 rounded-lg shadow p-4 text-sm">
          <div class="flex items-center gap-3">
            <div class="h-12 w-12 rounded-full bg-slate-200 dark:bg-slate-700 grid place-items-center text-slate-700 dark:text-slate-200 text-lg font-semibold">
              {{ (user.name || user.username || '?').slice(0,1).toUpperCase() }}
            </div>
            <div>
              <div class="text-base font-semibold">{{ user.name || user.username }}</div>
              <div class="text-xs text-slate-500 dark:text-slate-400">@{{ user.username }} · ID: {{ user.id }}</div>
              <div class="text-xs text-slate-500 dark:text-slate-400">Dibuat: {{ formatDate(user.createdAt) }} · Diupdate: {{ formatDate(user.updatedAt) }}</div>
            </div>
          </div>
        </div>

        <!-- Form: Update Profil -->
        <form @submit.prevent="submitProfile" class="bg-white dark:bg-slate-800 dark:border dark:border-slate-700 rounded-lg shadow p-4 text-sm space-y-3">
          <div class="font-semibold">Ubah Profil</div>
          <div class="grid grid-cols-1 gap-3">
            <label class="grid gap-1">
              <span class="text-xs text-slate-600 dark:text-slate-300">Nama</span>
              <input v-model="form.name" type="text" class="rounded-md border px-3 py-2 bg-white dark:bg-slate-900 dark:border-slate-700" placeholder="Nama lengkap" />
            </label>
            <label class="grid gap-1">
              <span class="text-xs text-slate-600 dark:text-slate-300">Username</span>
              <input v-model="form.username" type="text" required class="rounded-md border px-3 py-2 bg-white dark:bg-slate-900 dark:border-slate-700" placeholder="Username" />
            </label>
          </div>
          <div class="flex items-center gap-3">
            <button :disabled="savingProfile" class="rounded-md bg-blue-600 text-white px-3 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-60">
              {{ savingProfile ? 'Menyimpan...' : 'Simpan Perubahan' }}
            </button>
            <span v-if="profileMsg" :class="profileOk ? 'text-emerald-600' : 'text-red-600'" class="text-sm">{{ profileMsg }}</span>
          </div>
        </form>

        <!-- Form: Ganti Password -->
        <form @submit.prevent="submitPassword" class="bg-white dark:bg-slate-800 dark:border dark:border-slate-700 rounded-lg shadow p-4 text-sm space-y-3">
          <div class="font-semibold">Ganti Password</div>
          <div class="grid grid-cols-1 gap-3">
            <label class="grid gap-1">
              <span class="text-xs text-slate-600 dark:text-slate-300">Password saat ini</span>
              <input v-model="pwd.currentPassword" type="password" required class="rounded-md border px-3 py-2 bg-white dark:bg-slate-900 dark:border-slate-700" placeholder="••••••" />
            </label>
            <label class="grid gap-1">
              <span class="text-xs text-slate-600 dark:text-slate-300">Password baru</span>
              <input v-model="pwd.newPassword" type="password" required minlength="6" class="rounded-md border px-3 py-2 bg-white dark:bg-slate-900 dark:border-slate-700" placeholder="Minimal 6 karakter" />
            </label>
            <label class="grid gap-1">
              <span class="text-xs text-slate-600 dark:text-slate-300">Ulangi password baru</span>
              <input v-model="pwd.confirm" type="password" required class="rounded-md border px-3 py-2 bg-white dark:bg-slate-900 dark:border-slate-700" placeholder="Ulangi password baru" />
            </label>
          </div>
          <div class="flex items-center gap-3">
            <button :disabled="savingPwd" class="rounded-md bg-blue-600 text-white px-3 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-60">
              {{ savingPwd ? 'Menyimpan...' : 'Ubah Password' }}
            </button>
            <span v-if="pwdMsg" :class="pwdOk ? 'text-emerald-600' : 'text-red-600'" class="text-sm">{{ pwdMsg }}</span>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../services/api'

const user = ref(null)
const loading = ref(true)
const form = ref({ name: '', username: '' })
const savingProfile = ref(false)
const profileMsg = ref('')
const profileOk = ref(false)
const pwd = ref({ currentPassword: '', newPassword: '', confirm: '' })
const savingPwd = ref(false)
const pwdMsg = ref('')
const pwdOk = ref(false)

function formatDate(value) {
  if (!value) return '-'
  try { return new Date(value).toLocaleString() } catch { return value }
}

async function loadUser() {
  loading.value = true
  try {
    const res = await api.get('/auth/me')
    user.value = res.data
    form.value.name = res.data?.name || ''
    form.value.username = res.data?.username || ''
  } catch (e) {
    console.error('Failed to load user', e)
  } finally {
    loading.value = false
  }
}

onMounted(loadUser)

async function submitProfile() {
  profileMsg.value = ''
  profileOk.value = false
  savingProfile.value = true
  try {
    const payload = { name: form.value.name, username: form.value.username }
    const res = await api.patch('/auth/me', payload)
    user.value = res.data
    profileOk.value = true
    profileMsg.value = 'Profil berhasil diperbarui'
  } catch (e) {
    profileOk.value = false
    profileMsg.value = e?.response?.data?.message || 'Gagal memperbarui profil'
  } finally {
    savingProfile.value = false
  }
}

async function submitPassword() {
  pwdMsg.value = ''
  pwdOk.value = false
  if (pwd.value.newPassword !== pwd.value.confirm) {
    pwdMsg.value = 'Konfirmasi password tidak cocok'
    pwdOk.value = false
    return
  }
  savingPwd.value = true
  try {
    await api.patch('/auth/me/password', { currentPassword: pwd.value.currentPassword, newPassword: pwd.value.newPassword })
    pwdOk.value = true
    pwdMsg.value = 'Password berhasil diubah'
    pwd.value = { currentPassword: '', newPassword: '', confirm: '' }
  } catch (e) {
    pwdOk.value = false
    pwdMsg.value = e?.response?.data?.message || 'Gagal mengubah password'
  } finally {
    savingPwd.value = false
  }
}
</script>
