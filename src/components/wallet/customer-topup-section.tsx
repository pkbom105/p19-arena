'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, CheckCircle2, Loader2, MessageCircle, UploadCloud, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { apiUrl, BASE_PATH, lineRedirectUri } from '@/lib/api'
import { generatePromptPayQR } from '@/components/qrcode'
import { signIn, getSession } from 'next-auth/react'
import { MAX_SLIP_SIZE } from '@/components/dashboard/slip-helpers'

const LINE_CHANNEL_ID = process.env.NEXT_PUBLIC_LINE_CHANNEL_ID || 'YOUR_CHANNEL_ID'
const TOPUP_AMOUNTS = [100, 500, 1000, 2000] as const

interface WalletProfile {
  id: string
  lineDisplayName: string | null
  linePictureUrl: string | null
  name: string | null
  walletBalance: number
}

interface TopupRequest {
  id: string
  amount: number
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
  reviewedAt: string | null
}

interface SlipFile {
  dataUrl: string
  name: string
  size: number
}

/** โลโก้ Google (ตามแบรนด์ไกด์ของ Google) — ใช้ในปุ่ม "Continue with Google" */
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.86c2.26-2.09 3.56-5.17 3.56-8.87z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.29a11.99 11.99 0 0 0 0 10.76l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.7 0 3.99 2.47 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
    </svg>
  )
}

export function CustomerTopupSection() {
  const [profile, setProfile] = useState<WalletProfile | null>(null)
  const [requests, setRequests] = useState<TopupRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [qrLoading, setQrLoading] = useState(true)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [amount, setAmount] = useState<number>(TOPUP_AMOUNTS[0])
  const [slip, setSlip] = useState<SlipFile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [unauthenticated, setUnauthenticated] = useState(false)
  const [lineChannelId, setLineChannelId] = useState(LINE_CHANNEL_ID)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadRequests = async () => {
    const response = await fetch(apiUrl('/api/wallet/topups'), { cache: 'no-store' })
    if (!response.ok) throw new Error('Unable to load top-up history')
    const result: unknown = await response.json()
    if (!Array.isArray(result)) throw new Error('Invalid top-up history response')
    setRequests(result as TopupRequest[])
  }

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [profileResponse, settingsResponse] = await Promise.all([
          fetch(apiUrl('/api/wallet/session'), { cache: 'no-store' }),
          fetch(apiUrl('/api/settings'), { cache: 'no-store' }),
        ])

        if (settingsResponse.ok) {
          const settings: unknown = await settingsResponse.json()
          if (
            typeof settings === 'object' &&
            settings !== null &&
            'line_channel_id' in settings &&
            typeof settings.line_channel_id === 'string' &&
            settings.line_channel_id.trim()
          ) {
            setLineChannelId(settings.line_channel_id.trim())
          }
        }

        if (profileResponse.status === 401) {
          setUnauthenticated(true)
          return
        }
        if (!profileResponse.ok) throw new Error('Unable to load wallet profile')
        const profileResult: unknown = await profileResponse.json()
        if (
          typeof profileResult !== 'object' ||
          profileResult === null ||
          !('id' in profileResult) ||
          typeof profileResult.id !== 'string' ||
          !('walletBalance' in profileResult) ||
          typeof profileResult.walletBalance !== 'number'
        ) {
          throw new Error('Invalid wallet profile response')
        }
        if (cancelled) return
        setProfile(profileResult as WalletProfile)
        await loadRequests()
      } catch (loadError) {
        console.error('Failed to load wallet top-up page', loadError)
        if (!cancelled) setError('Unable to load your wallet. Please refresh and try again.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [])

  // กลับจาก Google (next-auth) → สะพานไปคุกกี้เซสชันเดิมของแอป แล้วโหลดโปรไฟล์ใหม่
  useEffect(() => {
    if (!unauthenticated) return
    let cancelled = false
    const syncGoogleSession = async () => {
      try {
        const googleSession = await getSession()
        if (!googleSession?.user?.googleId) return
        const response = await fetch(apiUrl('/api/auth/google/sync'), { method: 'POST' })
        if (!cancelled && response.ok) window.location.reload()
      } catch (syncError) {
        console.error('Failed to bridge Google session', syncError)
      }
    }
    void syncGoogleSession()
    return () => { cancelled = true }
  }, [unauthenticated])

  useEffect(() => {
    if (!profile) return
    let cancelled = false
    generatePromptPayQR(amount)
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl)
      })
      .catch((qrError: unknown) => {
        console.error('Failed to generate PromptPay QR', qrError)
        if (!cancelled) setError('Unable to generate the payment QR code.')
      })
      .finally(() => {
        if (!cancelled) setQrLoading(false)
      })
    return () => { cancelled = true }
  }, [amount, profile])

  /** เริ่มล็อกอิน Google ผ่าน next-auth — กลับมาที่หน้ากระเป๋าเงินเดิม */
  const startGoogleLogin = () => {
    void signIn('google', { callbackUrl: `${BASE_PATH}/account/topup` })
  }

  const startLineLogin = () => {
    const state = crypto.randomUUID()
    sessionStorage.setItem('line_login_state', state)
    sessionStorage.setItem('line_login_intent', 'topup')
    sessionStorage.setItem('line_login_return_to', `${BASE_PATH}/account/topup`)
    try {
      localStorage.setItem('line_login_state', state)
      localStorage.setItem('line_login_intent', 'topup')
      localStorage.setItem('line_login_return_to', `${BASE_PATH}/account/topup`)
    } catch (storageError) {
      console.error('Unable to persist LINE login state', storageError)
      setError('Your browser cannot safely start LINE login. Please enable browser storage and try again.')
      return
    }

    const authorization = new URLSearchParams({
      response_type: 'code',
      client_id: lineChannelId,
      redirect_uri: lineRedirectUri(),
      state,
      scope: 'profile openid',
      bot_prompt: 'normal',
    })
    window.location.assign(`https://access.line.me/oauth2/v2.1/authorize?${authorization.toString()}`)
  }

  const selectAmount = (nextAmount: number) => {
    if (nextAmount === amount) return
    setQrLoading(true)
    setQrDataUrl(null)
    setAmount(nextAmount)
  }

  const handleSlipChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    setError(null)
    setSlip(null)
    if (!file) return
    if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
      setError('Upload a JPEG or PNG image.')
      event.target.value = ''
      return
    }
    if (file.size > MAX_SLIP_SIZE) {
      setError('The slip must be 300 KB or smaller.')
      event.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => setSlip({ dataUrl: String(reader.result), name: file.name, size: file.size })
    reader.onerror = () => setError('Unable to read the selected slip image.')
    reader.readAsDataURL(file)
  }

  const submitRequest = async () => {
    setError(null)
    if (!slip) {
      setError('Upload your payment slip before submitting.')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(apiUrl('/api/wallet/topups'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, slipName: slip.name, slipDataUrl: slip.dataUrl }),
      })
      const result: unknown = await response.json()
      if (!response.ok) {
        const message =
          typeof result === 'object' && result !== null && 'error' in result && typeof result.error === 'string'
            ? result.error
            : 'Failed to submit top-up request'
        throw new Error(message)
      }

      await loadRequests()
      setSlip(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      toast.success('Top-up request submitted for review')
    } catch (submitError) {
      console.error('Failed to submit top-up request', submitError)
      setError(submitError instanceof Error ? submitError.message : 'Failed to submit top-up request')
    } finally {
      setSubmitting(false)
    }
  }

  const formatBaht = (value: number) =>
    new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(value)

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50/50 to-background px-4 py-6">
      <div className="mx-auto max-w-3xl space-y-5">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to booking
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Wallet Top Up</h1>
          <p className="text-sm text-muted-foreground">Add money to your P19 Arena wallet using PromptPay.</p>
        </div>

        {unauthenticated ? (
          <Card>
            <CardContent className="space-y-4 p-6 text-center">
              <Wallet className="mx-auto h-10 w-10 text-emerald-600" />
              <h2 className="font-semibold">Sign in to continue</h2>
              <p className="text-sm text-muted-foreground">Sign in with Google (Gmail) or LINE to top up your wallet.</p>
              <Button
                onClick={startGoogleLogin}
                variant="outline"
                className="w-full border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              >
                <GoogleIcon className="mr-2 h-4 w-4" /> Continue with Google
              </Button>
              <Button onClick={startLineLogin} className="w-full bg-green-600 text-white hover:bg-green-700">
                <MessageCircle className="mr-2 h-4 w-4" /> Continue with LINE
              </Button>
            </CardContent>
          </Card>
        ) : profile ? (
          <>
            <Card className="border-emerald-200">
              <CardContent className="flex items-center justify-between gap-4 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  {profile.linePictureUrl ? (
                    <img src={profile.linePictureUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Wallet className="h-5 w-5" /></span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-medium">{profile.lineDisplayName || profile.name || 'LINE member'}</p>
                    <p className="text-xs text-muted-foreground">Current wallet balance</p>
                  </div>
                </div>
                <p className="shrink-0 text-lg font-bold text-emerald-700">{formatBaht(profile.walletBalance)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">1. Choose amount</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {TOPUP_AMOUNTS.map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    variant={amount === preset ? 'default' : 'outline'}
                    onClick={() => selectAmount(preset)}
                    className={amount === preset ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                  >
                    {formatBaht(preset)}
                  </Button>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">2. Pay with PromptPay</CardTitle></CardHeader>
              <CardContent className="flex flex-col items-center gap-3">
                {qrLoading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                ) : qrDataUrl ? (
                  <img src={qrDataUrl} alt={`PromptPay QR for ${formatBaht(amount)}`} className="h-56 w-56 rounded-xl border p-2" />
                ) : null}
                <p className="text-sm text-muted-foreground">Scan and transfer exactly {formatBaht(amount)}.</p>
                <p className="text-xs text-amber-700">Your balance will update after staff verify your payment slip.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">3. Upload payment slip</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                  onChange={handleSlipChange}
                  className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:text-emerald-700"
                />
                <p className="text-xs text-muted-foreground">JPEG or PNG, up to 300 KB.</p>
                {slip && (
                  <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                    <img src={slip.dataUrl} alt="Selected payment slip" className="h-16 w-16 rounded object-cover" />
                    <span className="min-w-0 flex-1 truncate text-sm">{slip.name}</span>
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  </div>
                )}
                <Button onClick={submitRequest} disabled={submitting || !slip} className="w-full bg-emerald-600 hover:bg-emerald-700">
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                  Submit for review
                </Button>
                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Top-up request history</CardTitle></CardHeader>
              <CardContent>
                {requests.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No top-up requests yet.</p>
                ) : (
                  <ul className="divide-y">
                    {requests.map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                        <span>{formatBaht(item.amount)} · {new Date(item.createdAt).toLocaleDateString('th-TH')}</span>
                        <span className={
                          item.status === 'approved'
                            ? 'font-medium text-emerald-700'
                            : item.status === 'rejected'
                              ? 'font-medium text-destructive'
                              : 'font-medium text-amber-700'
                        }>
                          {item.status === 'approved' ? 'Approved' : item.status === 'rejected' ? 'Rejected' : 'Pending review'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error || 'Unable to load your wallet profile.'}
          </p>
        )}
      </div>
    </main>
  )
}
