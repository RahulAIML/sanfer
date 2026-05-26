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

  const activities = activitiesQ.data?.data ?? []
  const sims = filterTestUsers(simsQ.data ?? [])
  const members = membersQ.data?.data ?? []
  const admins = adminsQ.data?.data ?? []

  const kpis = isLoading || isError ? null : computeKPIs(sims, activities, members, admins)
  const trend = isLoading || isError ? null : computeTrend(sims)
  const roundStats = isLoading || isError ? null : computeRoundStats(sims)
  const actStats = isLoading || isError ? null : computeActivityStats(sims, activities)
  const userStats = isLoading || isError ? null : computeUserStats(sims)
  const scoreDist = isLoading || isError ? null : computeScoreDistribution(sims)
  const orgTree = isLoading || isError ? null : buildOrgTree(admins, members)
  const feedback = isLoading || isError ? null : extractFeedback(sims)

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
    refetch: () => {
      activitiesQ.refetch()
      simsQ.refetch()
      membersQ.refetch()
      adminsQ.refetch()
    },
  }
}
