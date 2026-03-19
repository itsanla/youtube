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
const INSOMEIN_VIDEO_PLANS_KEY = 'insomein:video_plans'
const INSOMEIN_LAST_DATE_KEY = 'insomein:last_date'

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

function safeJsonParsePlan(value: string): VideoPlan | null {
  try {
    const parsed = JSON.parse(value) as Partial<VideoPlan>
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

export async function getVideoPlans(): Promise<VideoPlan[]> {
  await ensureDefaultChannel()

  const rawPlans = await redis.zrange<string[]>(INSOMEIN_VIDEO_PLANS_KEY, 0, -1)
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
    const usedTitles = await redis.smembers<string[]>(USED_MOVIE_TITLES_KEY)
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
    const storedLastDate = await redis.get<string>(INSOMEIN_LAST_DATE_KEY)

    let nextDate = today
    if (storedLastDate && isValidDateString(storedLastDate) && storedLastDate >= today) {
      nextDate = addDays(storedLastDate, 1)
    }

    const plansToCreate: VideoPlan[] = []

    for (const title of newTitles) {
      const year = nextDate.slice(0, 4)
      plansToCreate.push({
        judul_video: `Review ${title} - Film Terbaik ${year}`,
        judul_film: title,
        tanggal_upload: nextDate,
      })
      nextDate = addDays(nextDate, 1)
    }

    const pipeline = redis.pipeline()

    for (const plan of plansToCreate) {
      pipeline.zadd(INSOMEIN_VIDEO_PLANS_KEY, {
        score: toUnixTimestamp(plan.tanggal_upload),
        member: JSON.stringify(plan),
      })
    }

    for (const title of newTitles) {
      pipeline.sadd(USED_MOVIE_TITLES_KEY, title)
    }

    const finalDate = plansToCreate[plansToCreate.length - 1]?.tanggal_upload
    if (finalDate) {
      pipeline.set(INSOMEIN_LAST_DATE_KEY, finalDate)
    }

    await pipeline.exec()

    revalidatePath('/dashboard')
    revalidatePath('/channels')

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
