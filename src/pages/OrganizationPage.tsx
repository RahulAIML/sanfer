import { useDashboardData } from '../hooks/useDashboardData'
import { useAppStore } from '../store'
import { useTranslation } from '../lib/i18n'
import { Building2, Users, Mail, Shield, UserCheck } from 'lucide-react'
import type { OrgNode } from '../lib/analytics'

export default function OrganizationPage() {
  const { language } = useAppStore()
  const t = useTranslation(language)
  const { isLoading, isError, orgTree, members, admins, refetch } = useDashboardData()

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 skeleton rounded-lg" />
        <div className="card p-5 h-96 skeleton rounded-xl" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <p className="text-slate-400">{t('error')}</p>
        <button onClick={refetch} className="btn-primary">{t('retry')}</button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-50 tracking-tight">{t('page_org_title')}</h1>
        <p className="text-slate-500 text-sm mt-0.5">{t('page_org_subtitle')}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Shield} label={t('kpi_total_admins')} value={admins.filter((a) => a.rpa_profile_type === 'admin').length} color="accent" />
        <StatCard icon={UserCheck} label={t('kpi_total_supervisors')} value={admins.filter((a) => a.rpa_profile_type === 'supervisor').length} color="violet" />
        <StatCard icon={Users} label={t('kpi_total_members')} value={members.length} color="success" />
      </div>

      {/* Tree */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-slate-200 mb-4">{t('organization_structure')}</h3>
        <div className="space-y-2">
          {(orgTree ?? []).map((node) => (
            <OrgTreeNode key={node.id} node={node} depth={0} />
          ))}
        </div>
      </div>

      {/* Members table */}
      <div className="card overflow-hidden">
        <h3 className="text-sm font-semibold text-slate-200 px-4 pt-4 mb-2">{t('kpi_total_members')}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line/40">
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{t('col_advisor')}</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{t('col_email')}</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{t('col_type')}</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{t('col_members')}</th>
              </tr>
            </thead>
            <tbody>
              {members.slice(0, 50).map((m) => {
                const admin = admins.find((a) => a.rpa_id === m.mb_admin)
                return (
                  <tr key={m.mb_id} className="border-b border-line/20 hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-slate-200 font-medium">{m.mb_fullname}</td>
                    <td className="px-4 py-3 max-w-[160px]"><span className="text-slate-400 text-xs block truncate">{m.mb_email}</span></td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{m.mb_designation || t('member')}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{admin?.rpa_full_name ?? '-'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  const colorClass = {
    accent: 'text-accent bg-accent/10',
    violet: 'text-violet bg-violet/10',
    success: 'text-success bg-success/10',
  }[color] || 'text-accent bg-accent/10'
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-500 font-medium mb-1 truncate">{label}</p>
          <p className="metric-value">{value}</p>
        </div>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ml-2 ${colorClass}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
    </div>
  )
}

function OrgTreeNode({ node, depth }: { node: OrgNode; depth: number }) {
  const indent = Math.min(depth * 20, 60)
  const iconMap: Record<string, any> = {
    supervisor: Shield,
    admin: UserCheck,
    dev: Building2,
    tenant: Building2,
    enradmin: Shield,
  }
  const Icon = iconMap[node.type] || Users
  return (
    <div>
      <div
        className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/[0.02] transition-colors"
        style={{ marginLeft: indent }}
      >
        <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
          <Icon className="w-3.5 h-3.5 text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-200 truncate">{node.name}</p>
          <p className="text-[11px] text-slate-600 flex items-center gap-1 truncate">
            <Mail className="w-3 h-3 shrink-0" /> <span className="truncate">{node.email}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 shrink-0 ml-2">
          <span className="capitalize hidden sm:inline">{node.type}</span>
          <span className="bg-surface px-1.5 py-0.5 rounded text-slate-600 text-[10px] whitespace-nowrap">{node.memberCount}</span>
        </div>
      </div>
      {node.children.length > 0 && (
        <div className="border-l border-line/20 ml-5">
          {node.children.map((child) => (
            <OrgTreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}
