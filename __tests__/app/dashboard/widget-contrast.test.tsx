import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { dashboardCanvasTheme, dashboardCanvasTokens, dashboardTokens, theme } from '@/app/theme'
import { MetricCard } from '@/app/dashboard/MetricCard'

function luminance(hex: string) {
  const channels = hex.match(/[a-f0-9]{2}/gi)!.map((channel) => {
    const value = parseInt(channel, 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}

function contrast(foreground: string, background: string) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
  return (values[0] + 0.05) / (values[1] + 0.05)
}

it('keeps normal widget text and semantic colours above 4.5:1 on light surfaces', () => {
  const tokens = dashboardCanvasTokens
  for (const background of [tokens.surface, tokens.surfaceAlt, tokens.shell, '#DBEAFE']) {
    for (const foreground of [
      tokens.text, tokens.textMuted, tokens.textSoft, tokens.textSubtle,
      tokens.positive, tokens.warning, tokens.negative, tokens.info, tokens.adjusted,
      dashboardCanvasTheme.palette.primary.main,
    ]) {
      expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5)
    }
  }
})

it.each([
  ['light', dashboardCanvasTheme, dashboardCanvasTokens],
  ['dark', theme, dashboardTokens],
] as const)('uses the %s theme for metric values, labels, and source details', (_name, activeTheme, tokens) => {
  render(
    <ThemeProvider theme={activeTheme}>
      <MetricCard label="Cash" value="NZD 185,000" color="#116B4D"
        sourceLabel="Document" sourceTone="derived" contextLabel="Latest recorded" detail="Verified" />
    </ThemeProvider>,
  )
  expect(screen.getByText('NZD 185,000')).toHaveStyle({ color: tokens.text })
  expect(screen.getByText('Cash')).toHaveStyle({ color: tokens.textMuted })
  expect(screen.getByText('Source: Document')).toHaveStyle({ color: tokens.textMuted })
  expect(screen.getByText('Latest recorded')).toHaveStyle({ color: activeTheme.palette.info.main })
})
