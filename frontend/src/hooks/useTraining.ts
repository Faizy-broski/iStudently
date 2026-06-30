'use client'

import useSWR from 'swr'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import { trainingApi, TrainingSession, CourseRegistration } from '@/lib/api/training'

const SWR_CONFIG = {
  revalidateOnFocus: false,
  keepPreviousData: true,
  errorRetryCount: 2,
}

export function useTrainingSessions() {
  const { user } = useAuth()
  const campusContext = useCampus()

  const cacheKey = user
    ? ['training-sessions', user.id, campusContext?.selectedCampus?.id]
    : null

  const { data, error, isLoading, mutate } = useSWR(
    cacheKey,
    async () => {
      const res = await trainingApi.listSessions()
      if (!res.success) throw new Error(res.error ?? 'Failed to fetch training sessions')
      return res.data ?? []
    },
    SWR_CONFIG
  )

  return {
    sessions: (data ?? []) as TrainingSession[],
    isLoading,
    error,
    mutate,
  }
}

export function useTrainingSession(id: string | null) {
  const { user } = useAuth()

  const cacheKey = user && id ? ['training-session', id, user.id] : null

  const { data, error, isLoading, mutate } = useSWR(
    cacheKey,
    async () => {
      const res = await trainingApi.getSession(id!)
      if (!res.success) throw new Error(res.error ?? 'Failed to fetch session')
      return res.data
    },
    SWR_CONFIG
  )

  return {
    session: data as TrainingSession | undefined,
    isLoading,
    error,
    mutate,
  }
}

export function useRegistrations(
  sessionId: string | null,
  filters: {
    status?: string
    payment_status?: string
    search?: string
    page?: number
    limit?: number
  } = {}
) {
  const { user } = useAuth()

  const cacheKey =
    user && sessionId
      ? [
          'training-registrations',
          sessionId,
          user.id,
          filters.status,
          filters.payment_status,
          filters.search,
          filters.page,
        ]
      : null

  const { data, error, isLoading, mutate } = useSWR(
    cacheKey,
    async () => {
      const res = await trainingApi.listRegistrations(sessionId!, filters)
      if (!res.success) throw new Error(res.error ?? 'Failed to fetch registrations')
      return {
        registrations: (res as any).data ?? [],
        pagination: (res as any).pagination ?? {},
      }
    },
    SWR_CONFIG
  )

  return {
    registrations: (data?.registrations ?? []) as CourseRegistration[],
    pagination: data?.pagination ?? {},
    isLoading,
    error,
    mutate,
  }
}
