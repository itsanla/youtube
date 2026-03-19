import { notFound } from 'next/navigation'
import { getChannels, getVideoPlans } from '@/app/actions/channel-actions'
import { ChannelDetailContent } from '@/app/components/ChannelDetailContent'

interface ChannelDetailPageProps {
  params: Promise<{ channelName: string }>
}

export default async function ChannelDetailPage({ params }: ChannelDetailPageProps) {
  const { channelName } = await params
  const normalizedChannelName = decodeURIComponent(channelName).trim().toLocaleLowerCase()

  if (!normalizedChannelName) {
    notFound()
  }

  const channels = await getChannels()
  if (!channels.includes(normalizedChannelName)) {
    notFound()
  }

  const plans = await getVideoPlans(normalizedChannelName)

  return <ChannelDetailContent channelName={normalizedChannelName} plans={plans} />
}
