import { useEffect, useState } from 'react'
import { getMyTeam } from '../../lib/api.ts'

interface TeamMember {
  id: number
  name: string
  email: string
  avatar?: string | null
}

interface Team {
  id: number
  name: string
  group_id: number
  group_name: string
  members: TeamMember[]
}

export default function StudentTeam() {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadMyTeam()
  }, [])

  async function loadMyTeam() {
    try {
      setLoading(true)
      setError('')

      const response = await getMyTeam()

      setTeams(response.data ?? [])
    } catch (err: any) {
      console.error('Team loading error:', err)

      setError(
        err?.message || 'Could not load your team.'
      )
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <p
          className="text-sm"
          style={{ color: 'var(--muted-foreground)' }}
        >
          Loading your team...
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div
          className="rounded-xl p-5"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
          }}
        >
          <h1
            className="text-xl font-semibold mb-2"
            style={{ fontFamily: 'Outfit, sans-serif' }}
          >
            My Team
          </h1>

          <p
            className="text-sm"
            style={{ color: '#B91C1C' }}
          >
            {error}
          </p>

          <button
            onClick={loadMyTeam}
            className="mt-4 px-3 py-1.5 rounded-md text-sm"
            style={{
              background: 'var(--primary)',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (teams.length === 0) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div
          className="rounded-xl p-8 text-center"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
          }}
        >
          <h1
            className="text-xl font-semibold mb-2"
            style={{ fontFamily: 'Outfit, sans-serif' }}
          >
            My Team
          </h1>

          <p
            className="text-sm"
            style={{ color: 'var(--muted-foreground)' }}
          >
            You are not assigned to a team yet.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1
          className="text-2xl font-semibold"
          style={{ fontFamily: 'Outfit, sans-serif' }}
        >
          My Team
        </h1>

        <p
          className="text-sm mt-1"
          style={{ color: 'var(--muted-foreground)' }}
        >
          View your team and team members.
        </p>
      </div>

      <div className="space-y-6">
        {teams.map((team) => (
          <div
            key={team.id}
            className="rounded-xl overflow-hidden"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
            }}
          >
            {/* Team header */}
            <div
              className="px-5 py-4"
              style={{
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2
                    className="text-lg font-semibold"
                    style={{ fontFamily: 'Outfit, sans-serif' }}
                  >
                    {team.name}
                  </h2>

                  <p
                    className="text-sm mt-1"
                    style={{
                      color: 'var(--muted-foreground)',
                    }}
                  >
                    {team.group_name}
                  </p>
                </div>

                <span
                  className="text-xs font-medium px-2.5 py-1 rounded-full"
                  style={{
                    background: 'var(--secondary)',
                    color: 'var(--foreground)',
                  }}
                >
                  {team.members.length}{' '}
                  {team.members.length === 1
                    ? 'member'
                    : 'members'}
                </span>
              </div>
            </div>

            {/* Members */}
            <div className="p-5">
              <h3 className="text-sm font-semibold mb-3">
                Team Members
              </h3>

              <div className="space-y-2">
                {team.members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-3 rounded-lg"
                    style={{
                      background: 'var(--background)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {/* Avatar */}
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{
                        background:
                          member.avatar ||
                          'var(--primary)',
                      }}
                    >
                      {member.name
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    {/* User info */}
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {member.name}
                      </p>

                      <p
                        className="text-xs truncate"
                        style={{
                          color:
                            'var(--muted-foreground)',
                        }}
                      >
                        {member.email}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}