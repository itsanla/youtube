'use server'

import { revalidatePath } from 'next/cache'
import { redis } from '@/lib/redis'
import type {
  ChannelActionState,
  MovieSubmitState,
  VideoPlan,
} from '@/lib/youtube-types'

const CHANNELS_KEY = 'channels'
const DEFAULT_CHANNEL = 'insomein'
const USED_MOVIE_TITLES_KEY = 'used_movie_titles'

function sanitizeChannelName(channelName: string): string {
  return channelName.trim().toLocaleLowerCase()
}

function getChannelPlanKey(channelName: string): string {
  return `${channelName}:video_plans`
}

function getChannelLastDateKey(channelName: string): string {
  return `${channelName}:last_date`
}

function getChannelUsedTitlesKey(channelName: string): string {
  if (channelName === DEFAULT_CHANNEL) {
    return USED_MOVIE_TITLES_KEY
  }

  return `${channelName}:used_movie_titles`
}

function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime())
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function addDays(dateStr: string, days: number): string {
  const base = new Date(`${dateStr}T00:00:00.000Z`)
  base.setUTCDate(base.getUTCDate() + days)
  return toDateString(base)
}

function toUnixTimestamp(dateStr: string): number {
  return Math.floor(new Date(`${dateStr}T00:00:00.000Z`).getTime() / 1000)
}

function normalizeTitle(title: string): string {
  return title.trim().toLocaleLowerCase()
}

function safeJsonParsePlan(value: string | Record<string, unknown>): VideoPlan | null {
  try {
    // Upstash Redis library auto-parses JSON strings ke objects
    // jadi value bisa string atau object
    const parsed: Partial<VideoPlan> =
      typeof value === 'string' ? JSON.parse(value) : value

    if (
      typeof parsed.judul_video === 'string' &&
      typeof parsed.judul_film === 'string' &&
      typeof parsed.tanggal_upload === 'string' &&
      isValidDateString(parsed.tanggal_upload)
    ) {
      return {
        judul_video: parsed.judul_video,
        judul_film: parsed.judul_film,
        tanggal_upload: parsed.tanggal_upload,
      }
    }

    return null
  } catch {
    return null
  }
}

async function ensureDefaultChannel(): Promise<void> {
  await redis.sadd(CHANNELS_KEY, DEFAULT_CHANNEL)
}

export async function getChannels(): Promise<string[]> {
  await ensureDefaultChannel()

  const channels = await redis.smembers<string[]>(CHANNELS_KEY)
  return [...channels].sort((a, b) => a.localeCompare(b, 'id'))
}

export async function getVideoPlans(channelName = DEFAULT_CHANNEL): Promise<VideoPlan[]> {
  await ensureDefaultChannel()

  const normalizedChannelName = sanitizeChannelName(channelName)
  const planKey = getChannelPlanKey(normalizedChannelName)

  const rawPlans = await redis.zrange<(string | Record<string, unknown>)[]>(planKey, 0, -1)

  const parsed = rawPlans
    .map((plan) => safeJsonParsePlan(plan))
    .filter((plan): plan is VideoPlan => plan !== null)

  return parsed.sort((a, b) => a.tanggal_upload.localeCompare(b.tanggal_upload))
}

function parseMovieTitleArray(input: string): string[] {
  const parsed = JSON.parse(input) as unknown

  if (!Array.isArray(parsed)) {
    throw new Error('Format JSON harus array string, contoh: ["Inception", "Parasite"]')
  }

  const unique = new Set<string>()
  const result: string[] = []

  for (const item of parsed) {
    if (typeof item !== 'string') {
      throw new Error('Semua elemen JSON harus string judul film')
    }

    const title = item.trim()
    if (!title) {
      continue
    }

    const key = normalizeTitle(title)
    if (unique.has(key)) {
      continue
    }

    unique.add(key)
    result.push(title)
  }

  if (result.length === 0) {
    throw new Error('Array judul film kosong setelah dibersihkan')
  }

  return result
}

export async function createChannel(
  _prevState: ChannelActionState,
  formData: FormData
): Promise<ChannelActionState> {
  const channelName = formData.get('channelName')

  if (typeof channelName !== 'string') {
    return {
      status: 'error',
      message: 'Nama channel tidak valid',
    }
  }

  const cleanedName = channelName.trim()
  if (!cleanedName) {
    return {
      status: 'error',
      message: 'Nama channel wajib diisi',
    }
  }

  await ensureDefaultChannel()

  try {
    const inserted = await redis.sadd(CHANNELS_KEY, cleanedName)

    if (inserted === 0) {
      return {
        status: 'error',
        message: `Channel "${cleanedName}" sudah ada`,
      }
    }

    revalidatePath('/dashboard')
    revalidatePath('/channels')

    return {
      status: 'success',
      message: `Channel "${cleanedName}" berhasil ditambahkan`,
    }
  } catch {
    return {
      status: 'error',
      message: 'Gagal menambahkan channel. Coba lagi.',
    }
  }
}

export async function submitMovieTitles(
  _prevState: MovieSubmitState,
  formData: FormData
): Promise<MovieSubmitState> {
  await ensureDefaultChannel()

  const rawJson = formData.get('movieTitlesJson')
  const intent = formData.get('intent')
  const channelNameInput = formData.get('channelName')

  if (typeof rawJson !== 'string') {
    return {
      status: 'error',
      message: 'Input judul film tidak valid',
      alreadyUsed: [],
      newTitles: [],
      createdPlans: [],
    }
  }

  if (intent !== 'analyze' && intent !== 'save') {
    return {
      status: 'error',
      message: 'Aksi form tidak valid',
      alreadyUsed: [],
      newTitles: [],
      createdPlans: [],
    }
  }

  if (typeof channelNameInput !== 'string') {
    return {
      status: 'error',
      message: 'Nama channel tidak valid',
      alreadyUsed: [],
      newTitles: [],
      createdPlans: [],
    }
  }

  const channelName = sanitizeChannelName(channelNameInput)
  if (!channelName) {
    return {
      status: 'error',
      message: 'Nama channel tidak valid',
      alreadyUsed: [],
      newTitles: [],
      createdPlans: [],
    }
  }

  const channels = await getChannels()
  if (!channels.includes(channelName)) {
    return {
      status: 'error',
      message: 'Channel tidak ditemukan',
      alreadyUsed: [],
      newTitles: [],
      createdPlans: [],
    }
  }

  const usedMovieTitlesKey = getChannelUsedTitlesKey(channelName)
  const videoPlansKey = getChannelPlanKey(channelName)
  const lastDateKey = getChannelLastDateKey(channelName)

  let parsedTitles: string[] = []

  try {
    parsedTitles = parseMovieTitleArray(rawJson)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'JSON tidak valid'
    return {
      status: 'error',
      message,
      alreadyUsed: [],
      newTitles: [],
      createdPlans: [],
    }
  }

  try {
    const usedTitles = await redis.smembers<string[]>(usedMovieTitlesKey)
    const usedByNormalized = new Map<string, string>()

    for (const usedTitle of usedTitles) {
      usedByNormalized.set(normalizeTitle(usedTitle), usedTitle)
    }

    const alreadyUsed: string[] = []
    const newTitles: string[] = []

    for (const title of parsedTitles) {
      const normalized = normalizeTitle(title)
      if (usedByNormalized.has(normalized)) {
        alreadyUsed.push(title)
      } else {
        newTitles.push(title)
      }
    }

    if (intent === 'analyze') {
      return {
        status: 'success',
        message: 'Analisa selesai. Cek daftar judul di bawah.',
        alreadyUsed,
        newTitles,
        createdPlans: [],
      }
    }

    if (newTitles.length === 0) {
      return {
        status: 'error',
        message: 'Tidak ada judul baru untuk disimpan',
        alreadyUsed,
        newTitles,
        createdPlans: [],
      }
    }

    const today = toDateString(new Date())
    const storedLastDate = await redis.get<string>(lastDateKey)

    let nextDate = today
    if (storedLastDate && isValidDateString(storedLastDate) && storedLastDate > today) {
      nextDate = addDays(storedLastDate, 1)
    }

    const plansToCreate: VideoPlan[] = []

    for (const title of newTitles) {
      plansToCreate.push({
        judul_video: '', // kosongkan, user akan submit manualnya
        judul_film: title,
        tanggal_upload: nextDate,
      })
      nextDate = addDays(nextDate, 1)
    }

    const pipeline = redis.pipeline()

    for (const plan of plansToCreate) {
      const jsonStr = JSON.stringify(plan)
      pipeline.zadd(videoPlansKey, {
        score: toUnixTimestamp(plan.tanggal_upload),
        member: jsonStr,
      })
    }

    for (const title of newTitles) {
      pipeline.sadd(usedMovieTitlesKey, title)
    }

    const finalDate = plansToCreate[plansToCreate.length - 1]?.tanggal_upload
    if (finalDate) {
      pipeline.set(lastDateKey, finalDate)
    }

    await pipeline.exec()

    revalidatePath('/dashboard')
    revalidatePath('/channels')
    revalidatePath(`/dashboard/${channelName}`)

    return {
      status: 'success',
      message: `${plansToCreate.length} rencana video berhasil dibuat`,
      alreadyUsed,
      newTitles,
      createdPlans: plansToCreate,
    }
  } catch {
    return {
      status: 'error',
      message: 'Gagal memproses judul film. Coba lagi.',
      alreadyUsed: [],
      newTitles: [],
      createdPlans: [],
    }
  }
}

export async function updateVideoPlanTitle(
  channelName: string,
  judul_film: string,
  tanggal_upload: string,
  judul_video_baru: string
): Promise<ChannelActionState> {
  const normalizedChannelName = sanitizeChannelName(channelName)

  if (!normalizedChannelName || !judul_video_baru.trim()) {
    return {
      status: 'error',
      message: 'Channel atau judul_video tidak valid',
    }
  }

  if (!isValidDateString(tanggal_upload)) {
    return {
      status: 'error',
      message: 'Format tanggal tidak valid',
    }
  }

  const channels = await getChannels()
  if (!channels.includes(normalizedChannelName)) {
    return {
      status: 'error',
      message: 'Channel tidak ditemukan',
    }
  }

  try {
    const videoPlansKey = getChannelPlanKey(normalizedChannelName)
    const allPlans = await redis.zrange<string[]>(videoPlansKey, 0, -1)

    const planToUpdate = allPlans.find((planStr) => {
      const plan = safeJsonParsePlan(planStr)
      return (
        plan?.judul_film === judul_film &&
        plan?.tanggal_upload === tanggal_upload
      )
    })

    if (!planToUpdate) {
      return {
        status: 'error',
        message: 'Rencana video tidak ditemukan',
      }
    }

    const updatedPlan: VideoPlan = {
      judul_video: judul_video_baru.trim(),
      judul_film: judul_film,
      tanggal_upload: tanggal_upload,
    }

    const score = toUnixTimestamp(tanggal_upload)

    const pipeline = redis.pipeline()
    pipeline.zrem(videoPlansKey, planToUpdate)
    pipeline.zadd(videoPlansKey, {
      score: score,
      member: JSON.stringify(updatedPlan),
    })

    await pipeline.exec()

    revalidatePath(`/dashboard/${normalizedChannelName}`)

    return {
      status: 'success',
      message: 'Judul video berhasil diperbarui',
    }
  } catch {
    return {
      status: 'error',
      message: 'Gagal memperbarui judul video. Coba lagi.',
    }
  }
}
