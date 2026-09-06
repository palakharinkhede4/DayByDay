# DayByDay Custom Android & Web Icon Generator
Add-Type -AssemblyName System.Drawing

function Draw-DayByDayIcon {
    param(
        [int]$Size,
        [string]$Type, # "square", "round", "foreground"
        [string]$OutputPath
    )

    $bmp = New-Object System.Drawing.Bitmap $Size, $Size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    $scale = $Size / 108.0

    if ($Type -eq "foreground") {
        # Transparent background for adaptive icon foreground
        $g.Clear([System.Drawing.Color]::Transparent)
    } else {
        # Background: Deep Obsidian
        $g.Clear([System.Drawing.Color]::Transparent)
        $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
            (New-Object System.Drawing.PointF 0, 0),
            (New-Object System.Drawing.PointF $Size, $Size),
            [System.Drawing.Color]::FromArgb(255, 15, 23, 42),
            [System.Drawing.Color]::FromArgb(255, 9, 13, 22)
        )

        if ($Type -eq "round") {
            $g.FillEllipse($bgBrush, 2, 2, ($Size - 4), ($Size - 4))
            $borderPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(40, 255, 255, 255)), (1.5 * $scale)
            $g.DrawEllipse($borderPen, 2, 2, ($Size - 4), ($Size - 4))
        } else {
            # Squircle / Rounded rect
            $rect = New-Object System.Drawing.RectangleF 1, 1, ($Size - 2), ($Size - 2)
            $radius = 24.0 * $scale
            $path = New-Object System.Drawing.Drawing2D.GraphicsPath
            $path.AddArc($rect.X, $rect.Y, $radius, $radius, 180, 90)
            $path.AddArc(($rect.Right - $radius), $rect.Y, $radius, $radius, 270, 90)
            $path.AddArc(($rect.Right - $radius), ($rect.Bottom - $radius), $radius, $radius, 0, 90)
            $path.AddArc($rect.X, ($rect.Bottom - $radius), $radius, $radius, 90, 90)
            $path.CloseFigure()
            $g.FillPath($bgBrush, $path)
            $borderPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(35, 255, 255, 255)), (1.5 * $scale)
            $g.DrawPath($borderPen, $path)
        }

        # Ambient Glow
        $glowBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(35, 0, 229, 153))
        $glowR = 40.0 * $scale
        $g.FillEllipse($glowBrush, ($Size/2 - $glowR), ($Size/2 - $glowR), ($glowR * 2), ($glowR * 2))
    }

    # Outer Momentum Ring (Arc)
    $arcPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 0, 229, 153)), (5.5 * $scale)
    $arcPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $arcPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $ringRect = New-Object System.Drawing.RectangleF (27 * $scale), (27 * $scale), (54 * $scale), (54 * $scale)
    $g.DrawArc($arcPen, $ringRect, 60, 260)

    # Momentum Flame Core
    $flamePath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $ptTop = New-Object System.Drawing.PointF (54 * $scale), (32 * $scale)
    $ptR1 = New-Object System.Drawing.PointF (64 * $scale), (43 * $scale)
    $ptR2 = New-Object System.Drawing.PointF (64 * $scale), (53 * $scale)
    $ptBottom = New-Object System.Drawing.PointF (54 * $scale), (63.5 * $scale)
    $ptL2 = New-Object System.Drawing.PointF (44 * $scale), (53 * $scale)
    $ptL1 = New-Object System.Drawing.PointF (44 * $scale), (43 * $scale)
    
    $flamePath.AddBezier($ptTop, $ptR1, $ptR2, $ptBottom)
    $flamePath.AddBezier($ptBottom, $ptL2, $ptL1, $ptTop)
    $flamePath.CloseFigure()

    $flameBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
        (New-Object System.Drawing.PointF (54 * $scale), (32 * $scale)),
        (New-Object System.Drawing.PointF (54 * $scale), (64 * $scale)),
        [System.Drawing.Color]::FromArgb(255, 255, 184, 0),
        [System.Drawing.Color]::FromArgb(255, 0, 229, 153)
    )
    $g.FillPath($flameBrush, $flamePath)

    # Inner Core Spark (white highlight)
    $sparkBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
    $sparkPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $spTop = New-Object System.Drawing.PointF (54 * $scale), (46 * $scale)
    $spR = New-Object System.Drawing.PointF (58 * $scale), (54 * $scale)
    $spBot = New-Object System.Drawing.PointF (54 * $scale), (58.5 * $scale)
    $spL = New-Object System.Drawing.PointF (50 * $scale), (54 * $scale)
    $sparkPath.AddBezier($spTop, $spR, $spR, $spBot)
    $sparkPath.AddBezier($spBot, $spL, $spL, $spTop)
    $sparkPath.CloseFigure()
    $g.FillPath($sparkBrush, $sparkPath)

    # Accent Node
    $nodeBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 0, 229, 153))
    $nodeR = 3.2 * $scale
    $nodeCenter = New-Object System.Drawing.PointF (34 * $scale), (70 * $scale)
    $g.FillEllipse($nodeBrush, ($nodeCenter.X - $nodeR), ($nodeCenter.Y - $nodeR), ($nodeR * 2), ($nodeR * 2))

    # Sparkle
    $goldBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 213, 79))
    $goldR = 2.2 * $scale
    $goldCenter = New-Object System.Drawing.PointF (74 * $scale), (31 * $scale)
    $g.FillEllipse($goldBrush, ($goldCenter.X - $goldR), ($goldCenter.Y - $goldR), ($goldR * 2), ($goldR * 2))

    $g.Dispose()
    $bmp.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Output "Generated: $OutputPath ($Size x $Size)"
}

$densities = @(
    @{ Name = "mdpi"; LauncherSize = 48; ForegroundSize = 108 },
    @{ Name = "hdpi"; LauncherSize = 72; ForegroundSize = 162 },
    @{ Name = "xhdpi"; LauncherSize = 96; ForegroundSize = 216 },
    @{ Name = "xxhdpi"; LauncherSize = 144; ForegroundSize = 324 },
    @{ Name = "xxxhdpi"; LauncherSize = 192; ForegroundSize = 432 }
)

$baseDir = "android\app\src\main\res"

foreach ($d in $densities) {
    $folder = Join-Path $baseDir "mipmap-$($d.Name)"
    if (!(Test-Path $folder)) { New-Item -ItemType Directory -Path $folder -Force | Out-Null }
    
    Draw-DayByDayIcon -Size $d.LauncherSize -Type "square" -OutputPath (Join-Path $folder "ic_launcher.png")
    Draw-DayByDayIcon -Size $d.LauncherSize -Type "round" -OutputPath (Join-Path $folder "ic_launcher_round.png")
    Draw-DayByDayIcon -Size $d.ForegroundSize -Type "foreground" -OutputPath (Join-Path $folder "ic_launcher_foreground.png")
}

# Also generate web public/icon.png
Draw-DayByDayIcon -Size 512 -Type "square" -OutputPath "public\icon.png"
Write-Output "All icons successfully generated!"
