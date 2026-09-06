# DayByDay Custom Trophy & Victory Tick Icon Generator
Add-Type -AssemblyName System.Drawing

function Draw-TrophyIcon {
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

    # Base scale: standard canvas is 108 units
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
            [System.Drawing.Color]::FromArgb(255, 14, 22, 38),
            [System.Drawing.Color]::FromArgb(255, 4, 6, 12)
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

        # Ambient Glow behind Trophy
        $glowBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(45, 0, 229, 153))
        $glowR = 38.0 * $scale
        $g.FillEllipse($glowBrush, ($Size/2 - $glowR), ($Size/2 - $glowR), ($glowR * 2), ($glowR * 2))
    }

    # 1. Outer Momentum Ring (Arc)
    $arcPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 0, 229, 153)), (5.0 * $scale)
    $arcPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $arcPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $ringRect = New-Object System.Drawing.RectangleF (26 * $scale), (26 * $scale), (56 * $scale), (56 * $scale)
    $g.DrawArc($arcPen, $ringRect, 50, 275)

    # Momentum Ring Accent Node
    $nodeBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 0, 229, 153))
    $nodeR = 3.5 * $scale
    $nodeCenter = New-Object System.Drawing.PointF (62 * $scale), (29 * $scale)
    $g.FillEllipse($nodeBrush, ($nodeCenter.X - $nodeR), ($nodeCenter.Y - $nodeR), ($nodeR * 2), ($nodeR * 2))
    $nodeCenterBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
    $g.FillEllipse($nodeCenterBrush, ($nodeCenter.X - 1.5 * $scale), ($nodeCenter.Y - 1.5 * $scale), (3.0 * $scale), (3.0 * $scale))

    # 2. Trophy Handles
    $handlePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 245, 158, 11)), (3.2 * $scale)
    $handlePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $handlePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    # Left Handle
    $leftHandlePath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $leftHandlePath.AddBezier(
        (New-Object System.Drawing.PointF (38 * $scale), (43 * $scale)),
        (New-Object System.Drawing.PointF (28 * $scale), (43 * $scale)),
        (New-Object System.Drawing.PointF (28 * $scale), (57 * $scale)),
        (New-Object System.Drawing.PointF (38 * $scale), (57 * $scale))
    )
    $g.DrawPath($handlePen, $leftHandlePath)

    # Right Handle
    $rightHandlePath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $rightHandlePath.AddBezier(
        (New-Object System.Drawing.PointF (70 * $scale), (43 * $scale)),
        (New-Object System.Drawing.PointF (80 * $scale), (43 * $scale)),
        (New-Object System.Drawing.PointF (80 * $scale), (57 * $scale)),
        (New-Object System.Drawing.PointF (70 * $scale), (57 * $scale))
    )
    $g.DrawPath($handlePen, $rightHandlePath)

    # 3. Trophy Pedestal & Stem
    $pedestalBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
        (New-Object System.Drawing.PointF (54 * $scale), (62 * $scale)),
        (New-Object System.Drawing.PointF (54 * $scale), (76 * $scale)),
        [System.Drawing.Color]::FromArgb(255, 245, 158, 11),
        [System.Drawing.Color]::FromArgb(255, 146, 64, 14)
    )

    # Stem
    $g.FillRectangle($pedestalBrush, (51.5 * $scale), (61 * $scale), (5 * $scale), (7 * $scale))

    # Base Tier 1
    $g.FillRectangle($pedestalBrush, (47 * $scale), (68 * $scale), (14 * $scale), (3 * $scale))

    # Base Tier 2 (Foot)
    $footPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $footRect = New-Object System.Drawing.RectangleF (42 * $scale), (71 * $scale), (24 * $scale), (4 * $scale)
    $footPath.AddRectangle($footRect)
    $g.FillPath($pedestalBrush, $footPath)

    # 4. Trophy Cup Body
    $cupPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $ptTL = New-Object System.Drawing.PointF (37 * $scale), (39 * $scale)
    $ptTR = New-Object System.Drawing.PointF (71 * $scale), (39 * $scale)
    $ptR = New-Object System.Drawing.PointF (68 * $scale), (55 * $scale)
    $ptBot = New-Object System.Drawing.PointF (54 * $scale), (62 * $scale)
    $ptL = New-Object System.Drawing.PointF (40 * $scale), (55 * $scale)

    $cupPath.AddLine($ptTL, $ptTR)
    $cupPath.AddBezier($ptTR, $ptR, (New-Object System.Drawing.PointF (62 * $scale), (61 * $scale)), $ptBot)
    $cupPath.AddBezier($ptBot, (New-Object System.Drawing.PointF (46 * $scale), (61 * $scale)), $ptL, $ptTL)
    $cupPath.CloseFigure()

    $cupBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
        (New-Object System.Drawing.PointF (37 * $scale), (39 * $scale)),
        (New-Object System.Drawing.PointF (71 * $scale), (62 * $scale)),
        [System.Drawing.Color]::FromArgb(255, 254, 240, 138),
        [System.Drawing.Color]::FromArgb(255, 217, 119, 6)
    )
    $g.FillPath($cupBrush, $cupPath)

    # Cup Rim (Top Ellipse)
    $rimBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
        (New-Object System.Drawing.PointF (37 * $scale), (36 * $scale)),
        (New-Object System.Drawing.PointF (71 * $scale), (42 * $scale)),
        [System.Drawing.Color]::FromArgb(255, 255, 255, 255),
        [System.Drawing.Color]::FromArgb(255, 245, 158, 11)
    )
    $g.FillEllipse($rimBrush, (37 * $scale), (37 * $scale), (34 * $scale), (4.5 * $scale))

    # Star Sparkle at Cup Apex
    $starBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 254, 240, 138))
    $starPts = @(
        (New-Object System.Drawing.PointF (54 * $scale), (31 * $scale)),
        (New-Object System.Drawing.PointF (55.5 * $scale), (33.5 * $scale)),
        (New-Object System.Drawing.PointF (58 * $scale), (34 * $scale)),
        (New-Object System.Drawing.PointF (55.5 * $scale), (34.5 * $scale)),
        (New-Object System.Drawing.PointF (54 * $scale), (37 * $scale)),
        (New-Object System.Drawing.PointF (52.5 * $scale), (34.5 * $scale)),
        (New-Object System.Drawing.PointF (50 * $scale), (34 * $scale)),
        (New-Object System.Drawing.PointF (52.5 * $scale), (33.5 * $scale))
    )
    $starPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $starPath.AddPolygon($starPts)
    $g.FillPath($starBrush, $starPath)

    # 5. Bold Victory Tick (Checkmark) Superimposed on Cup
    # Emerald Background Glow for Tick
    $tickGlowPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(120, 0, 229, 153)), (6.5 * $scale)
    $tickGlowPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $tickGlowPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $tickGlowPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

    $tickPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $tickPath.AddLine((45.5 * $scale), (50 * $scale), (52 * $scale), (56.5 * $scale))
    $tickPath.AddLine((52 * $scale), (56.5 * $scale), (64 * $scale), (43.5 * $scale))

    $g.DrawPath($tickGlowPen, $tickPath)

    # Emerald Solid Tick
    $tickPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 0, 229, 153)), (4.5 * $scale)
    $tickPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $tickPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $tickPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $g.DrawPath($tickPen, $tickPath)

    # Inner White Core Highlight for Tick
    $tickWhitePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White), (2.0 * $scale)
    $tickWhitePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $tickWhitePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $tickWhitePen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $g.DrawPath($tickWhitePen, $tickPath)

    # Save to disk
    $dir = Split-Path -Parent $OutputPath
    if (!(Test-Path $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    $bmp.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Generated: $OutputPath ($Size x $Size)"
}

Write-Host "Generating iOS, Android, and Web icons..."

# 1. iOS Universal AppIcon (1024 x 1024)
Draw-TrophyIcon -Size 1024 -Type "square" -OutputPath "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"

# 2. Web & PWA Icon (512 x 512)
Draw-TrophyIcon -Size 512 -Type "square" -OutputPath "public/icon.png"

# 3. Android Mipmaps
$densities = @(
    @{ Name = "mdpi"; LauncherSize = 48; ForeSize = 108 },
    @{ Name = "hdpi"; LauncherSize = 72; ForeSize = 162 },
    @{ Name = "xhdpi"; LauncherSize = 96; ForeSize = 216 },
    @{ Name = "xxhdpi"; LauncherSize = 144; ForeSize = 324 },
    @{ Name = "xxxhdpi"; LauncherSize = 192; ForeSize = 432 }
)

foreach ($d in $densities) {
    $dir = "android/app/src/main/res/mipmap-$($d.Name)"
    Draw-TrophyIcon -Size $d.LauncherSize -Type "square" -OutputPath "$dir/ic_launcher.png"
    Draw-TrophyIcon -Size $d.LauncherSize -Type "round" -OutputPath "$dir/ic_launcher_round.png"
    Draw-TrophyIcon -Size $d.ForeSize -Type "foreground" -OutputPath "$dir/ic_launcher_foreground.png"
}

Write-Host "All Trophy & Victory Tick icons generated successfully!"
