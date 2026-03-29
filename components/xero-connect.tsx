'use client'  // 'use client' tells Next.js this component runs in the browser, not on the server

// useState = stores component state (status, loading, toast etc)
// useEffect = runs code after the component mounts in the browser
// useCallback = memoizes a function so it doesn't get recreated on every render
import { useState, useEffect, useCallback } from 'react'

// MUI (Material UI) components — Team's UI library
import {
  Box, Button, Chip, CircularProgress,
  Snackbar, Alert, Typography, Paper,
} from '@mui/material'

// MUI icons used in the UI
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import LinkOffIcon from '@mui/icons-material/LinkOff'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'

// TypeScript interface describing the shape of the status data
// returned from /api/xero/status
interface XeroStatus {
  connected: boolean
  tenantName?: string
  connectedAt?: string
  expiresAt?: string
}

// TypeScript interface for the props this component accepts
interface XeroConnectProps {
  onStatusChange?: (connected: boolean) => void  // optional callback if parent needs to know
}

// The component accepts optional onStatusChange prop
export default function XeroConnect({ onStatusChange }: XeroConnectProps) {
  const [status, setStatus] = useState<XeroStatus | null>(null)  // status = the current Xero connection status fetched from /api/xero/status
  const [loading, setLoading] = useState(true)        // Used to show the spinner before we know if the user is connected
  const [disconnecting, setDisconnecting] = useState(false) 
  const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' } | null>(null) // toast = the success/error notification shown at the bottom of the screen

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/xero/status')
      if (res.ok) {
        // json.data because successResponse wraps everything in { success: true, data: ... }
        const json = await res.json()
        setStatus(json.data)
        onStatusChange?.(json.data.connected)
      }
    } catch {
      setStatus({ connected: false })
    } finally {
      setLoading(false)
    }
  }, [onStatusChange])

  // useEffect runs once after the component first mounts in the browser
  // The [fetchStatus] dependency means it reruns if fetchStatus changes
  // which only happens if onStatusChange changes
  useEffect(() => {
    fetchStatus()

    // After OAuth, Xero redirects back to /dashboard?xero=connected (or ?xero=error)
    // We read that param here to show a success/error toast, then clean it from the URL
    const params = new URLSearchParams(window.location.search)
    const xeroParam = params.get('xero')

    if (xeroParam === 'connected') {
      setToast({ message: 'Xero connected successfully!', severity: 'success' })
      const url = new URL(window.location.href)
      url.searchParams.delete('xero')
      window.history.replaceState({}, '', url.toString()) // remove ?xero= without page reload
    } else if (xeroParam === 'error') {
      setToast({ message: 'Failed to connect to Xero. Please try again.', severity: 'error' })
      const url = new URL(window.location.href)
      url.searchParams.delete('xero')
      window.history.replaceState({}, '', url.toString())
    }
  }, [fetchStatus])

  // Clicking "Connect to Xero" navigates to our connect route,
  // which then redirects to Xero — full page nav, not a fetch
  const handleConnect = () => {
    window.location.href = '/api/xero/connect'
  }

  const handleDisconnect = async () => {
    setDisconnecting(true)
    try {
      const res = await fetch('/api/xero/disconnect', { method: 'POST' })
      if (res.ok) {
        setStatus({ connected: false })
        onStatusChange?.(false)
        setToast({ message: 'Xero disconnected.', severity: 'success' })
      } else {
        setToast({ message: 'Failed to disconnect. Please try again.', severity: 'error' })
      }
    } catch {
      setToast({ message: 'Network error. Please try again.', severity: 'error' })
    } finally {
      setDisconnecting(false)
    }
  }

  // Show a spinner while we check connection status on first load
  if (loading) {
    return (
      <Box display="flex" alignItems="center" gap={1}>
        <CircularProgress size={20} />
        <Typography variant="body2" color="text.secondary">
          Checking Xero connection…
        </Typography>
      </Box>
    )
  }

  return (
    <>
      <Paper
        variant="outlined"
        sx={{ p: 2.5, display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', borderRadius: 2 }}
      >
        <Box display="flex" alignItems="center" gap={1.5}>
          <Box
            component="img"
            src="https://www.xero.com/content/dam/xero/pilot-images/logos/xero-logo-hq.svg"
            alt="Xero"
            sx={{ height: 28, width: 'auto' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
          <Box>
            <Typography variant="subtitle2" fontWeight={600}>Xero</Typography>
            {/* Show org name when connected, generic text when not */}
            <Typography variant="caption" color="text.secondary">
              {status?.connected && status.tenantName
                ? status.tenantName
                : 'Connect your accounting data'}
            </Typography>
          </Box>
          {status?.connected && (
            <Chip icon={<CheckCircleIcon />} label="Connected"
                  color="success" size="small" variant="outlined" />
          )}
        </Box>

        {/* Show Disconnect button when connected, Connect button when not */}
        {status?.connected ? (
          <Button
            variant="outlined" color="error" size="small"
            startIcon={disconnecting ? <CircularProgress size={14} /> : <LinkOffIcon />}
            onClick={handleDisconnect}
            disabled={disconnecting}
          >
            {disconnecting ? 'Disconnecting…' : 'Disconnect'}
          </Button>
        ) : (
          <Button
            variant="contained" size="small"
            startIcon={<OpenInNewIcon />}
            onClick={handleConnect}
            sx={{ bgcolor: '#13B5EA', '&:hover': { bgcolor: '#0fa0d0' },
                  textTransform: 'none', fontWeight: 600 }}
          >
            Connect to Xero
          </Button>
        )}
      </Paper>

      {/* Success/error toast shown after OAuth redirect or disconnect */}
      <Snackbar
        open={!!toast}
        autoHideDuration={5000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={toast?.severity} onClose={() => setToast(null)}
               variant="filled" sx={{ width: '100%' }}>
          {toast?.message}
        </Alert>
      </Snackbar>
    </>
  )
}