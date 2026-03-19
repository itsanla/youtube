export type ActionStatus = 'idle' | 'success' | 'error'

export interface VideoPlan {
  judul_video: string // will be filled manually by user
  judul_film: string
  tanggal_upload: string
}

export interface ChannelActionState {
  status: ActionStatus
  message: string
}

export interface MovieSubmitState extends ChannelActionState {
  alreadyUsed: string[]
  newTitles: string[]
  createdPlans: VideoPlan[]
}
