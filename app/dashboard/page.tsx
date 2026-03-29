import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import XeroConnect from '@/components/xero-connect'
import {
  Box,
  Button,
  Container,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { SignOutButton } from '@/components/sign-out-button'
import { COOKIE_ACCESS_TOKEN } from '@/lib/supabase'
import { getCurrentUserProfile } from '@/lib/auth'
import { dashboardTokens } from '@/app/theme'

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get(COOKIE_ACCESS_TOKEN)?.value

  if (!accessToken) {
    redirect('/sign-in')
  }

  const currentUser = await getCurrentUserProfile(accessToken).catch(() => null)

  if (!currentUser) {
    redirect('/sign-in')
  }

  const { profile } = currentUser

  return (
    <Box
      component="main"
      sx={{
        minHeight: '100vh',
        py: 2,
        bgcolor: dashboardTokens.shell,
      }}
    >
      <Container maxWidth={false} sx={{ height: { md: 'calc(100vh - 32px)' } }}>
        <Paper
          elevation={0}
          sx={{
            height: '100%',
            overflow: 'hidden',
            borderRadius: 4,
            border: '1px solid',
            borderColor: dashboardTokens.border,
            bgcolor: dashboardTokens.shell,
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '360px 1fr' },
              height: '100%',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                borderRight: { md: '1px solid' },
                borderRightColor: { md: dashboardTokens.border },
                bgcolor: dashboardTokens.sidebar,
              }}
            >
              <Box sx={{ p: 3 }}>
                <Stack spacing={0.5}>
                  <Typography variant="h5" component="h1" fontWeight={700} color="common.white">
                    AI-BOSS
                  </Typography>
                  <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
                    Financial intelligence assistant
                  </Typography>
                </Stack>
              </Box>

              <Divider sx={{ borderColor: dashboardTokens.border }} />

              <Box sx={{ p: 3, flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.5,
                    borderRadius: 3,
                    bgcolor: dashboardTokens.surfaceSoft,
                    border: '1px solid',
                    borderColor: dashboardTokens.border,
                    color: 'common.white',
                  }}
                >
                  <Stack spacing={2}>
                    <Typography variant="subtitle1" fontWeight={600}>
                      Welcome, {profile.full_name ?? profile.email}
                    </Typography>
                    <Typography variant="body2" sx={{ color: dashboardTokens.textSoft }}>
                      Ask AI-BOSS about runway, burn, policy checks, or scenario planning.
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      <Button
                        size="small"
                        variant="outlined"
                        sx={{
                          color: 'common.white',
                          borderColor: dashboardTokens.borderSoft,
                          borderRadius: 999,
                        }}
                      >
                        Runway
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        sx={{
                          color: 'common.white',
                          borderColor: dashboardTokens.borderSoft,
                          borderRadius: 999,
                        }}
                      >
                        Burn
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        sx={{
                          color: 'common.white',
                          borderColor: dashboardTokens.borderSoft,
                          borderRadius: 999,
                        }}
                      >
                        Scenario
                      </Button>
                    </Stack>
                  </Stack>
                </Paper>

                <Box sx={{ flex: 1, overflow: 'auto' }}>
                  <Stack spacing={2}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        borderRadius: 3,
                        bgcolor: dashboardTokens.surfaceAlt,
                        color: 'common.white',
                        border: '1px solid',
                        borderColor: dashboardTokens.border,
                      }}
                    >
                      <Typography variant="body2" sx={{ color: dashboardTokens.textSoft }}>
                        Hi {profile.full_name ?? 'there'} - I can help you understand your current financial position.
                      </Typography>
                    </Paper>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        borderRadius: 3,
                        bgcolor: dashboardTokens.surfaceAlt,
                        color: 'common.white',
                        border: '1px solid',
                        borderColor: dashboardTokens.border,
                      }}
                    >
                      <Typography variant="body2" sx={{ color: dashboardTokens.textSoft }}>
                        Try asking: &quot;What is our runway if revenue stays flat?&quot;
                      </Typography>
                    </Paper>
                  </Stack>
                </Box>

                <Box sx={{ pt: 1 }}>
                  <TextField
                    fullWidth
                    placeholder="Ask AI-BOSS something..."
                    variant="outlined"
                    size="small"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 999,
                        bgcolor: dashboardTokens.surfaceAlt,
                        color: 'common.white',
                      },
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: dashboardTokens.borderInput,
                      },
                      '& input': {
                        color: 'common.white',
                      },
                    }}
                  />
                </Box>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', bgcolor: dashboardTokens.shell }}>
              <Box
                sx={{
                  px: { xs: 3, sm: 4 },
                  py: 3,
                  borderBottom: '1px solid',
                  borderBottomColor: dashboardTokens.border,
                }}
              >
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={2}
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                  justifyContent="space-between"
                >
                  <Stack spacing={0.5}>
                    <Typography variant="h4" component="h1" fontWeight={700} color="common.white">
                      AI-BOSS Platform
                    </Typography>
                    <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
                      Barebones workspace for NZ/AU SME finance teams.
                    </Typography>
                  </Stack>

                  <SignOutButton />
                </Stack>

                <Stack
                  direction="row"
                  spacing={1.5}
                  useFlexGap
                  flexWrap="wrap"
                  sx={{ mt: 3 }}
                >
                  <Button variant="contained" sx={{ borderRadius: 999 }}>
                    Dashboard
                  </Button>
                  <Button
                    variant="outlined"
                    sx={{
                      borderRadius: 999,
                      color: 'common.white',
                      borderColor: dashboardTokens.borderMuted,
                    }}
                  >
                    Data Connectors
                  </Button>
                  <Button
                    variant="outlined"
                    sx={{
                      borderRadius: 999,
                      color: 'common.white',
                      borderColor: dashboardTokens.borderMuted,
                    }}
                  >
                    Scenarios
                  </Button>
                  <Button
                    variant="outlined"
                    sx={{
                      borderRadius: 999,
                      color: 'common.white',
                      borderColor: dashboardTokens.borderMuted,
                    }}
                  >
                    Exports
                  </Button>
                  <Button
                    variant="outlined"
                    sx={{
                      borderRadius: 999,
                      color: 'common.white',
                      borderColor: dashboardTokens.borderMuted,
                    }}
                  >
                    Settings
                  </Button>
                </Stack>
              </Box>

              <Box sx={{ p: { xs: 3, sm: 4 }, flex: 1 }}>
                <Stack spacing={3}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 3,
                      borderRadius: 4,
                      bgcolor: dashboardTokens.surface,
                      color: 'common.white',
                      border: '1px solid',
                      borderColor: dashboardTokens.border,
                    }}
                  >
                    <Stack spacing={1}>
                      <Typography variant="h6" fontWeight={700}>
                        Runway Status
                      </Typography>
                      <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
                        This area will eventually hold summary cards, charts, and feature tabs.
                      </Typography>
                    </Stack>
                  </Paper>

                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
                      gap: 2,
                    }}
                  >
                    {['Weeks Left', 'Daily Burn', 'Risk Level'].map((label) => (
                      <Paper
                        key={label}
                        elevation={0}
                        sx={{
                          p: 2.5,
                          borderRadius: 4,
                          bgcolor: dashboardTokens.surface,
                          color: 'common.white',
                          border: '1px solid',
                          borderColor: dashboardTokens.border,
                          minHeight: 120,
                        }}
                      >
                        <Typography variant="body2" sx={{ color: dashboardTokens.textMuted }}>
                          {label}
                        </Typography>
                      </Paper>
                    ))}
                  </Box>
                  {/* Xero connection */}
                  <Paper
                    elevation={0}
                    sx={{
                      p: 3,
                      borderRadius: 4,
                      bgcolor: dashboardTokens.surface,
                      border: '1px solid',
                      borderColor: dashboardTokens.border,
                    }}
                  >
                    <Stack spacing={2}>
                      <Typography variant="h6" fontWeight={700} color="common.white">
                        Data Connectors
                      </Typography>
                      <XeroConnect />
                    </Stack>
                  </Paper>
                </Stack>
              </Box>
            </Box>
          </Box>
        </Paper>
      </Container>
    </Box>
  )
}
