import { useState } from 'react'
import type { User } from '../types'
import {
  updateUser,
  changePassword,
  ApiError,
} from '../lib/api'

interface Props {
  user: User
  onSave: (updated: User) => void
  onBack: () => void
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrator',
  teacher: 'Teacher',
  student: 'Student',
}

const AVATAR_COLORS = [
  '#1D4ED8',
  '#0891B2',
  '#7C3AED',
  '#059669',
  '#D97706',
  '#DC2626',
]

type ProfileUser = User & {
  bio?: string
  avatar?: string
  github_username?: string
}

export default function ProfilePage({ user, onSave, onBack }: Props) {
  const profileUser = user as ProfileUser

  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [bio, setBio] = useState(profileUser.bio || '')
  const [githubUsername, setGithubUsername] = useState(profileUser.github_username || '')
  const [avatarColor, setAvatarColor] = useState(
    profileUser.avatar || AVATAR_COLORS[0]
  )

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [saved, setSaved] = useState(false)
  const [passwordSaved, setPasswordSaved] = useState(false)

  const [errors, setErrors] = useState<{
    name?: string
    email?: string
    profile?: string
    password?: string
    confirm?: string
  }>({})

  // -----------------------------
  // PROFILE VALIDATION
  // -----------------------------

  function validateProfile() {
    const errors: {
      name?: string
      email?: string
    } = {}

    if (!name.trim()) {
      errors.name = 'Name is required'
    }

    if (!email.trim()) {
      errors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errors.email = 'Enter a valid email'
    }

    setErrors((prev) => ({
      ...prev,
      name: errors.name,
      email: errors.email,
    }))

    return Object.keys(errors).length === 0
  }

  // -----------------------------
  // SAVE PROFILE
  // -----------------------------

  async function handleSaveProfile() {
    if (!validateProfile()) return

    try {
      setErrors({})

      await updateUser(user.id, {
  name: name.trim(),
  email: email.trim(),
  bio: bio.trim(),
  avatar: avatarColor,
  ...(user.role === 'student'
    ? { github_username: githubUsername.trim().replace(/^@/, '') || null }
    : {})
})

      const updatedUser = {
        ...user,
        name: name.trim(),
        email: email.trim(),
        bio: bio.trim(),
        avatar: avatarColor,
        ...(user.role === 'student'
          ? { githubUsername: githubUsername.trim().replace(/^@/, '') || undefined }
          : {}),
      } as User

      onSave(updatedUser)

      setSaved(true)

      setTimeout(() => {
        setSaved(false)
      }, 3000)
    } catch (error) {
      console.error(error)

      if (error instanceof ApiError) {
        setErrors({
          profile: error.message,
        })
      } else {
        setErrors({
          profile: 'Could not save profile.',
        })
      }
    }
  }

  // -----------------------------
  // PASSWORD VALIDATION
  // -----------------------------

  function validatePassword() {
    const errors: {
      password?: string
      confirm?: string
    } = {}

    if (!currentPassword) {
      errors.password = 'Enter your current password'
    }

    if (!newPassword) {
      errors.password = 'Enter a new password'
    } else if (newPassword.length < 8) {
      errors.password = 'New password must be at least 8 characters'
    }

    if (!confirmPassword) {
      errors.confirm = 'Confirm your new password'
    } else if (newPassword !== confirmPassword) {
      errors.confirm = 'Passwords do not match'
    }

    setErrors((prev) => ({
      ...prev,
      password: errors.password,
      confirm: errors.confirm,
    }))

    return Object.keys(errors).length === 0
  }

  // -----------------------------
  // CHANGE PASSWORD
  // -----------------------------

  async function handleChangePassword() {
    if (!validatePassword()) return

    try {
      setErrors({})

      await changePassword(
        currentPassword,
        newPassword
      )

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')

      setPasswordSaved(true)

      setTimeout(() => {
        setPasswordSaved(false)
      }, 3000)
    } catch (error) {
      console.error(error)

      if (error instanceof ApiError) {
        setErrors({
          password: error.message,
        })
      } else {
        setErrors({
          password: 'Could not change password.',
        })
      }
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">

      {user.role === 'student' && (
        <div className="rounded-xl p-6 mb-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <h2 className="text-sm font-semibold mb-2">GitHub Profile</h2>
          <p className="text-xs mb-3" style={{ color: 'var(--muted-foreground)' }}>Add your GitHub username so teachers can identify your profile.</p>
          <div className="flex gap-2">
            <span className="px-3 py-2.5 rounded-lg text-sm" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}>github.com/</span>
            <input value={githubUsername} onChange={e => setGithubUsername(e.target.value)} placeholder="username" className="flex-1 px-3 py-2.5 rounded-lg text-sm" style={{ border: '1px solid var(--border)', background: 'var(--muted)', outline: 'none' }} />
          </div>
        </div>
      )}


      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm mb-6"
        style={{
          color: 'var(--muted-foreground)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        ← Back
      </button>

      {/* Header */}
      <div className="mb-6">
        <h1
          className="text-2xl font-semibold"
          style={{ fontFamily: 'Outfit, sans-serif' }}
        >
          My Profile
        </h1>

        <p
          className="text-sm mt-0.5"
          style={{ color: 'var(--muted-foreground)' }}
        >
          Manage your account details and password
        </p>
      </div>

      {/* Profile saved */}
      {saved && (
        <div
          className="mb-5 px-4 py-3 rounded-lg text-sm font-medium"
          style={{
            background: '#DCFCE7',
            color: '#15803D',
            border: '1px solid #BBF7D0',
          }}
        >
          Profile saved successfully.
        </div>
      )}

      {/* Password saved */}
      {passwordSaved && (
        <div
          className="mb-5 px-4 py-3 rounded-lg text-sm font-medium"
          style={{
            background: '#DCFCE7',
            color: '#15803D',
            border: '1px solid #BBF7D0',
          }}
        >
          Password changed successfully.
        </div>
      )}

      {/* Profile error */}
      {errors.profile && (
        <div
          className="mb-5 px-4 py-3 rounded-lg text-sm"
          style={{
            background: '#FEE2E2',
            color: '#B91C1C',
            border: '1px solid #FECACA',
          }}
        >
          {errors.profile}
        </div>
      )}

      {/* ----------------------------- */}
      {/* AVATAR */}
      {/* ----------------------------- */}

      <div
        className="rounded-xl p-6 mb-5"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
        }}
      >
        <h2 className="text-sm font-semibold mb-4">
          Avatar
        </h2>

        <div className="flex items-center gap-5">

          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white flex-shrink-0"
            style={{
              background: avatarColor,
            }}
          >
            {name.charAt(0).toUpperCase()}
          </div>

          <div>
            <p className="text-sm font-medium">
              {name || 'Your Name'}
            </p>

            <p
              className="text-xs mt-0.5"
              style={{
                color: 'var(--muted-foreground)',
              }}
            >
              {ROLE_LABEL[user.role]}
            </p>

            <div className="flex gap-2 mt-3">
              {AVATAR_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setAvatarColor(color)}
                  className="w-6 h-6 rounded-full flex-shrink-0"
                  style={{
                    background: color,
                    border:
                      avatarColor === color
                        ? '2px solid var(--foreground)'
                        : '2px solid transparent',
                    outline:
                      avatarColor === color
                        ? '2px solid white'
                        : 'none',
                    outlineOffset: '-4px',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ----------------------------- */}
      {/* PERSONAL INFORMATION */}
      {/* ----------------------------- */}

      <div
        className="rounded-xl p-6 mb-5"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
        }}
      >
        <h2 className="text-sm font-semibold mb-4">
          Personal Information
        </h2>

        <div className="space-y-4">

          {/* Name + Role */}
          <div className="grid grid-cols-2 gap-4">

            <div>
              <label
                className="block text-xs font-medium mb-1"
                style={{
                  color: 'var(--muted-foreground)',
                }}
              >
                Full Name{' '}
                <span style={{ color: '#EF4444' }}>
                  *
                </span>
              </label>

              <input
                value={name}
                onChange={(e) =>
                  setName(e.target.value)
                }
                className="w-full px-3 py-2.5 rounded-lg text-sm"
                style={{
                  border: `1px solid ${
                    errors.name
                      ? '#EF4444'
                      : 'var(--border)'
                  }`,
                  background: 'var(--muted)',
                  outline: 'none',
                }}
              />

              {errors.name && (
                <p
                  className="text-xs mt-1"
                  style={{ color: '#EF4444' }}
                >
                  {errors.name}
                </p>
              )}
            </div>

            <div>
              <label
                className="block text-xs font-medium mb-1"
                style={{
                  color: 'var(--muted-foreground)',
                }}
              >
                Role
              </label>

              <input
                value={ROLE_LABEL[user.role]}
                disabled
                className="w-full px-3 py-2.5 rounded-lg text-sm"
                style={{
                  border: '1px solid var(--border)',
                  background: 'var(--secondary)',
                  color: 'var(--muted-foreground)',
                  outline: 'none',
                }}
              />
            </div>

          </div>

          {/* Email */}
          <div>
            <label
              className="block text-xs font-medium mb-1"
              style={{
                color: 'var(--muted-foreground)',
              }}
            >
              Email Address{' '}
              <span style={{ color: '#EF4444' }}>
                *
              </span>
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              className="w-full px-3 py-2.5 rounded-lg text-sm"
              style={{
                border: `1px solid ${
                  errors.email
                    ? '#EF4444'
                    : 'var(--border)'
                }`,
                background: 'var(--muted)',
                outline: 'none',
              }}
            />

            {errors.email && (
              <p
                className="text-xs mt-1"
                style={{ color: '#EF4444' }}
              >
                {errors.email}
              </p>
            )}
          </div>

          {/* Bio */}
          <div>
            <label
              className="block text-xs font-medium mb-1"
              style={{
                color: 'var(--muted-foreground)',
              }}
            >
              Bio
            </label>

            <textarea
              value={bio}
              onChange={(e) =>
                setBio(e.target.value)
              }
              placeholder="A short bio about yourself…"
              rows={3}
              className="w-full px-3 py-2.5 rounded-lg text-sm resize-none"
              style={{
                border: '1px solid var(--border)',
                background: 'var(--muted)',
                outline: 'none',
              }}
            />
          </div>

        </div>
      </div>

      {/* ----------------------------- */}
      {/* CHANGE PASSWORD */}
      {/* ----------------------------- */}

      <div
        className="rounded-xl p-6 mb-6"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
        }}
      >
        <h2 className="text-sm font-semibold mb-1">
          Change Password
        </h2>

        <p
          className="text-xs mb-4"
          style={{
            color: 'var(--muted-foreground)',
          }}
        >
          Enter your current password and choose a new
          password.
        </p>

        <div className="space-y-3">

          {/* Current password */}
          <div>
            <label
              className="block text-xs font-medium mb-1"
              style={{
                color: 'var(--muted-foreground)',
              }}
            >
              Current Password
            </label>

            <input
              type="password"
              value={currentPassword}
              onChange={(e) =>
                setCurrentPassword(e.target.value)
              }
              placeholder="••••••••"
              className="w-full px-3 py-2.5 rounded-lg text-sm"
              style={{
                border: `1px solid ${
                  errors.password
                    ? '#EF4444'
                    : 'var(--border)'
                }`,
                background: 'var(--muted)',
                outline: 'none',
              }}
            />

            {errors.password && (
              <p
                className="text-xs mt-1"
                style={{ color: '#EF4444' }}
              >
                {errors.password}
              </p>
            )}
          </div>

          {/* New + Confirm */}
          <div className="grid grid-cols-2 gap-4">

            <div>
              <label
                className="block text-xs font-medium mb-1"
                style={{
                  color: 'var(--muted-foreground)',
                }}
              >
                New Password
              </label>

              <input
                type="password"
                value={newPassword}
                onChange={(e) =>
                  setNewPassword(e.target.value)
                }
                placeholder="••••••••"
                className="w-full px-3 py-2.5 rounded-lg text-sm"
                style={{
                  border: '1px solid var(--border)',
                  background: 'var(--muted)',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label
                className="block text-xs font-medium mb-1"
                style={{
                  color: 'var(--muted-foreground)',
                }}
              >
                Confirm New Password
              </label>

              <input
                type="password"
                value={confirmPassword}
                onChange={(e) =>
                  setConfirmPassword(e.target.value)
                }
                placeholder="••••••••"
                className="w-full px-3 py-2.5 rounded-lg text-sm"
                style={{
                  border: `1px solid ${
                    errors.confirm
                      ? '#EF4444'
                      : 'var(--border)'
                  }`,
                  background: 'var(--muted)',
                  outline: 'none',
                }}
              />

              {errors.confirm && (
                <p
                  className="text-xs mt-1"
                  style={{ color: '#EF4444' }}
                >
                  {errors.confirm}
                </p>
              )}
            </div>

          </div>

          {/* Password button */}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleChangePassword}
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{
                background: 'var(--secondary)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
              }}
            >
              Change Password
            </button>
          </div>

        </div>
      </div>

      {/* ----------------------------- */}
      {/* PROFILE BUTTONS */}
      {/* ----------------------------- */}

      <div className="flex justify-end gap-3">

        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2.5 rounded-lg text-sm"
          style={{
            border: '1px solid var(--border)',
            background: 'transparent',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={handleSaveProfile}
          className="px-6 py-2.5 rounded-lg text-sm font-semibold"
          style={{
            background: 'var(--primary)',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Save Changes
        </button>

      </div>

    </div>
  )
}