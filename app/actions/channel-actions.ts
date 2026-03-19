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

// Normalisasi judul: hapus SEMUA spasi dan convert ke lowercase
// "The Matrix" -> "thematrix"
// "the      Matrix" -> "thematrix"
// "ThE     mAtRiX" -> "thematrix"
function normalizeTitle(title: string): string {
  return title.replace(/\s+/g, '').toLowerCase()
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
        // Tampilkan judul asli dari database, bukan judul input
        const originalTitle = usedByNormalized.get(normalized)!
        alreadyUsed.push(originalTitle)
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

export async function updateVideoPlan(
  channelName: string,
  oldJudulFilm: string,
  oldTanggalUpload: string,
  newJudulVideo: string,
  newJudulFilm?: string,
  newTanggalUpload?: string
): Promise<ChannelActionState> {
  const normalizedChannelName = sanitizeChannelName(channelName)

  if (!normalizedChannelName) {
    return {
      status: 'error',
      message: 'Nama channel tidak valid',
    }
  }

  if (!isValidDateString(oldTanggalUpload)) {
    return {
      status: 'error',
      message: 'Format tanggal lama tidak valid',
    }
  }

  if (newTanggalUpload && !isValidDateString(newTanggalUpload)) {
    return {
      status: 'error',
      message: 'Format tanggal baru tidak valid',
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
    const allPlans = await redis.zrange<(string | Record<string, unknown>)[]>(
      videoPlansKey,
      0,
      -1,
      { withScores: true }
    )

    // Find the old plan by judul_film and tanggal_upload
    let oldPlanScore: number | null = null
    let foundOldPlan: VideoPlan | null = null

    for (let i = 0; i < allPlans.length; i += 2) {
      const planItem = allPlans[i]
      const plan = safeJsonParsePlan(planItem)

      if (
        plan?.judul_film === oldJudulFilm &&
        plan?.tanggal_upload === oldTanggalUpload
      ) {
        foundOldPlan = plan as VideoPlan
        oldPlanScore = Number(allPlans[i + 1])
        break
      }
    }

    if (!foundOldPlan || oldPlanScore === null) {
      return {
        status: 'error',
        message: 'Rencana video tidak ditemukan',
      }
    }

    // Create updated plan
    const actualNewJudulFilm = newJudulFilm || oldJudulFilm
    const actualNewTanggalUpload = newTanggalUpload || oldTanggalUpload

    const updatedPlan: VideoPlan = {
      judul_video: newJudulVideo.trim(),
      judul_film: actualNewJudulFilm.trim(),
      tanggal_upload: actualNewTanggalUpload,
    }

    const newScore = toUnixTimestamp(actualNewTanggalUpload)

    // Remove old plan by score and add new one
    const pipeline = redis.pipeline()
    pipeline.zremrangebyscore(videoPlansKey, oldPlanScore, oldPlanScore)
    pipeline.zadd(videoPlansKey, {
      score: newScore,
      member: JSON.stringify(updatedPlan),
    })

    await pipeline.exec()

    revalidatePath(`/dashboard/${normalizedChannelName}`)

    return {
      status: 'success',
      message: 'Rencana video berhasil diperbarui',
    }
  } catch (error) {
    console.error('updateVideoPlan error:', error)
    return {
      status: 'error',
      message: 'Gagal memperbarui rencana video. Coba lagi.',
    }
  }
}

export async function deleteVideoPlan(
  channelName: string,
  judul_film: string,
  tanggal_upload: string
): Promise<ChannelActionState> {
  const normalizedChannelName = sanitizeChannelName(channelName)

  if (!normalizedChannelName) {
    return {
      status: 'error',
      message: 'Nama channel tidak valid',
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

    // Get all plans with scores to find the exact score to delete
    const allPlans = await redis.zrange<(string | Record<string, unknown>)[]>(
      videoPlansKey,
      0,
      -1,
      { withScores: true }
    )

    let planScore: number | null = null

    for (let i = 0; i < allPlans.length; i += 2) {
      const planItem = allPlans[i]
      const plan = safeJsonParsePlan(planItem)

      if (
        plan?.judul_film === judul_film &&
        plan?.tanggal_upload === tanggal_upload
      ) {
        planScore = Number(allPlans[i + 1])
        break
      }
    }

    if (planScore === null) {
      return {
        status: 'error',
        message: 'Rencana video tidak ditemukan',
      }
    }

    // Use zremrangebyscore to remove by score (more reliable)
    await redis.zremrangebyscore(videoPlansKey, planScore, planScore)

    // Check apakah ada rencana video lain dengan judul_film yang sama
    const remainingPlans = await redis.zrange<(string | Record<string, unknown>)[]>(
      videoPlansKey,
      0,
      -1
    )

    const hasSameFilm = remainingPlans.some((planItem) => {
      const plan = safeJsonParsePlan(planItem)
      return plan?.judul_film === judul_film
    })

    // Jika tidak ada rencana dengan judul film yang sama, hapus dari used_movie_titles
    if (!hasSameFilm) {
      const usedMovieTitlesKey = getChannelUsedTitlesKey(normalizedChannelName)
      
      // Cari judul asli di used_movie_titles untuk dihapus
      const usedTitles = await redis.smembers<string[]>(usedMovieTitlesKey)
      for (const usedTitle of usedTitles) {
        if (normalizeTitle(usedTitle) === normalizeTitle(judul_film)) {
          await redis.srem(usedMovieTitlesKey, usedTitle)
          break
        }
      }
    }

    revalidatePath(`/dashboard/${normalizedChannelName}`)

    return {
      status: 'success',
      message: 'Rencana video berhasil dihapus',
    }
  } catch (error) {
    console.error('deleteVideoPlan error:', error)
    return {
      status: 'error',
      message: 'Gagal menghapus rencana video. Coba lagi.',
    }
  }
}

export async function createVideoPlan(
  channelName: string,
  judulVideo: string,
  judulFilm: string,
  tanggalUpload: string
): Promise<ChannelActionState> {
  const normalizedChannelName = sanitizeChannelName(channelName)

  if (!normalizedChannelName) {
    return {
      status: 'error',
      message: 'Nama channel tidak valid',
    }
  }

  if (!judulFilm.trim()) {
    return {
      status: 'error',
      message: 'Judul film tidak boleh kosong',
    }
  }

  if (!isValidDateString(tanggalUpload)) {
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
    const usedMovieTitlesKey = getChannelUsedTitlesKey(normalizedChannelName)

    // Check apakah judul film sudah dipakai
    const usedTitles = await redis.smembers<string[]>(usedMovieTitlesKey)
    
    for (const usedTitle of usedTitles) {
      if (normalizeTitle(usedTitle) === normalizeTitle(judulFilm)) {
        return {
          status: 'error',
          message: `Judul film "${usedTitle}" sudah pernah dipakai`,
        }
      }
    }

    // Buat rencana video baru
    const plan: VideoPlan = {
      judul_video: judulVideo.trim(),
      judul_film: judulFilm.trim(),
      tanggal_upload: tanggalUpload,
    }

    const score = toUnixTimestamp(tanggalUpload)

    // Save ke Redis
    const pipeline = redis.pipeline()
    pipeline.zadd(videoPlansKey, {
      score: score,
      member: JSON.stringify(plan),
    })
    pipeline.sadd(usedMovieTitlesKey, plan.judul_film)

    await pipeline.exec()

    revalidatePath(`/dashboard/${normalizedChannelName}`)

    return {
      status: 'success',
      message: 'Rencana video berhasil ditambahkan',
    }
  } catch (error) {
    console.error('createVideoPlan error:', error)
    return {
      status: 'error',
      message: 'Gagal menambahkan rencana video. Coba lagi.',
    }
  }
}
