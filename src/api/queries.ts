import { useQuery } from '@tanstack/react-query'
import { fetchActivities, fetchAdmins, fetchLines, fetchMembers, fetchSimulations } from './client'

const STALE = 1000 * 60 * 5 // 5 minutes

export function useActivities() {
  return useQuery({
    queryKey: ['activities'],
    queryFn: fetchActivities,
    staleTime: STALE,
    select: (res) => res.data,
  })
}

export function useSimulations() {
  return useQuery({
    queryKey: ['simulations'],
    queryFn: fetchSimulations,
    staleTime: STALE,
  })
}

export function useMembers() {
  return useQuery({
    queryKey: ['members'],
    queryFn: fetchMembers,
    staleTime: STALE,
    select: (res) => res.data,
  })
}

export function useAdmins() {
  return useQuery({
    queryKey: ['admins'],
    queryFn: fetchAdmins,
    staleTime: STALE,
    select: (res) => res.data,
  })
}

export function useLines() {
  return useQuery({
    queryKey: ['lines'],
    queryFn: fetchLines,
    staleTime: STALE,
    select: (res) => res.data,
  })
}

export function useAllData() {
  const sims = useSimulations()
  const activities = useActivities()
  const members = useMembers()
  const admins = useAdmins()

  return {
    sims: sims.data ?? [],
    activities: activities.data ?? [],
    members: members.data ?? [],
    admins: admins.data ?? [],
    isLoading: sims.isLoading || activities.isLoading || members.isLoading || admins.isLoading,
    isError: sims.isError || activities.isError || members.isError || admins.isError,
    error: sims.error ?? activities.error ?? members.error ?? admins.error,
  }
}
