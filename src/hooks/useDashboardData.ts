import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchActivities, fetchSimulations, fetchMembers, fetchAdmins } from '../api/client'
import {
  computeKPIs,
  computeTrend,
  computeRoundStats,
  computeActivityStats,
  computeUserStats,
  computeScoreDistribution,
  buildOrgTree,
  extractFeedback,
  filterTestUsers,
} from '../lib/analytics'

export function useDashboardData() {
  const activitiesQ = useQuery({ queryKey: ['activities'], queryFn: fetchActivities })
  const simsQ = useQuery({ queryKey: ['simulations'], queryFn: fetchSimulations })
  const membersQ = useQuery({ queryKey: ['members'], queryFn: fetchMembers })
  const adminsQ = useQuery({ queryKey: ['admins'], queryFn: fetchAdmins })

  const isLoading = activitiesQ.isLoading || simsQ.isLoading || membersQ.isLoading || adminsQ.isLoading
  const isError = activitiesQ.isError || simsQ.isError || membersQ.isError || adminsQ.isError

  const activities = useMemo(() => activitiesQ.data?.data ?? [], [activitiesQ.data])
  const sims = useMemo(() => filterTestUsers(simsQ.data ?? []), [simsQ.data])
  const members = useMemo(() => membersQ.data?.data ?? [], [membersQ.data])
  const admins = useMemo(() => adminsQ.data?.data ?? [], [adminsQ.data])

  const kpis = useMemo(
    () => (isLoading || isError ? null : computeKPIs(sims, activities, members, admins)),
    [isLoading, isError, sims, activities, members, admins],
  )
  const trend = useMemo(
    () => (isLoading || isError ? null : computeTrend(sims)),
    [isLoading, isError, sims],
  )
  const roundStats = useMemo(
    () => (isLoading || isError ? null : computeRoundStats(sims)),
    [isLoading, isError, sims],
  )
  const actStats = useMemo(
    () => (isLoading || isError ? null : computeActivityStats(sims, activities)),
    [isLoading, isError, sims, activities],
  )
  const userStats = useMemo(
    () => (isLoading || isError ? null : computeUserStats(sims)),
    [isLoading, isError, sims],
  )
  const scoreDist = useMemo(
    () => (isLoading || isError ? null : computeScoreDistribution(sims)),
    [isLoading, isError, sims],
  )
  const orgTree = useMemo(
    () => (isLoading || isError ? null : buildOrgTree(admins, members)),
    [isLoading, isError, admins, members],
  )
  const feedback = useMemo(
    () => (isLoading || isError ? null : extractFeedback(sims)),
    [isLoading, isError, sims],
  )

  const refetch = useMemo(
    () => () => {
      activitiesQ.refetch()
      simsQ.refetch()
      membersQ.refetch()
      adminsQ.refetch()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  return {
    isLoading,
    isError,
    activities,
    sims,
    members,
    admins,
    kpis,
    trend,
    roundStats,
    actStats,
    userStats,
    scoreDist,
    orgTree,
    feedback,
    refetch,
  }
}
