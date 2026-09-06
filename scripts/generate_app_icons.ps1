# DayByDay Premium App Icon Generator
# Aesthetic: Deep Pastel Navy & Soft Sky Blue with Concentric Habit Progress Ring & Victory Tick
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
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    # 108 unit coordinate grid
    $scale = $Size / 108.0

    if ($Type -eq "foreground") {
        # Transparent canvas for Android Adaptive Icon Foreground
        $g.Clear([System.Drawing.Color]::Transparent)
    } else {
        # Rich Deep Navy Gradient Background
        $g.Clear([System.Drawing.Color]::Transparent)
        $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
            (New-Object System.Drawing.PointF 0, 0),
            (New-Object System.Drawing.PointF $Size, $Size),
            [System.Drawing.Color]::FromArgb(255, 12, 22, 44),  # Rich Navy Top
            [System.Drawing.Color]::FromArgb(255, 5, 8, 18)     # Deep Midnight Bottom
        )

        if ($Type -eq "round") {
            $g.FillEllipse($bgBrush, 2, 2, ($Size - 4), ($Size - 4))
            $borderPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(60, 126, 184, 247)), (1.5 * $scale)
            $g.DrawEllipse($borderPen, 2, 2, ($Size - 4), ($Size - 4))
        } else {
            # Squircle with smooth rounded corners
            $rect = New-Object System.Drawing.RectangleF 1, 1, ($Size - 2), ($Size - 2)
            $radius = 24.0 * $scale
            $path = New-Object System.Drawing.Drawing2D.GraphicsPath
            $path.AddArc($rect.X, $rect.Y, $radius, $radius, 180, 90)
            $path.AddArc(($rect.Right - $radius), $rect.Y, $radius, $radius, 270, 90)
            $path.AddArc(($rect.Right - $radius), ($rect.Bottom - $radius), $radius, $radius, 0, 90)
            $path.AddArc($rect.X, ($rect.Bottom - $radius), $radius, $radius, 90, 90)
            $path.CloseFigure()
            $g.FillPath($bgBrush, $path)

            # Delicate outer rim highlight
            $borderPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(50, 126, 184, 247)), (1.5 * $scale)
            $g.DrawPath($borderPen, $path)
        }

        # Ambient Center Glow (Soft Sky Blue Aura)
        $glowBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(40, 126, 184, 247))
        $glowR = 34.0 * $scale
        $g.FillEllipse($glowBrush, ($Size/2 - $glowR), ($Size/2 - $glowR), ($glowR * 2), ($glowR * 2))

        $glowInner = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(55, 26, 86, 196))
        $glowInnerR = 22.0 * $scale
        $g.FillEllipse($glowInner, ($Size/2 - $glowInnerR), ($Size/2 - $glowInnerR), ($glowInnerR * 2), ($glowInnerR * 2))
    }

    # ================= EMBLEM (Within 72dp Safe Zone) =================
    # Center is at (54, 54) in 108dp canvas

    # 1. Background Inactive Habit Ring Track
    $trackPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(60, 40, 65, 110)), (5.5 * $scale)
    $trackPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $trackPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $ringRect = New-Object System.Drawing.RectangleF (27 * $scale), (27 * $scale), (54 * $scale), (54 * $scale)
    $g.DrawEllipse($trackPen, $ringRect)

    # 2. Active Habit Progress Arc (285 degrees)
    # Gradient brush for arc from Deep Navy (#1A56C4) to Pastel Sky Blue (#7EB8F7)
    $arcPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 126, 184, 247)), (6.0 * $scale)
    $arcPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $arcPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $g.DrawArc($arcPen, $ringRect, 135, 275)

    # 3. Inner Secondary Habit Ring (representing dual co-op/streak habit)
    $innerTrackPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(45, 30, 50, 90)), (3.5 * $scale)
    $innerRingRect = New-Object System.Drawing.RectangleF (35 * $scale), (35 * $scale), (38 * $scale), (38 * $scale)
    $g.DrawEllipse($innerTrackPen, $innerRingRect)

    $innerArcPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(230, 26, 86, 196)), (4.0 * $scale)
    $innerArcPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $innerArcPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $g.DrawArc($innerArcPen, $innerRingRect, 220, 220)

    # 4. Progress Arc Pearl Tip Node (with glowing aura)
    $nodeCenterX = 71.35 * $scale
    $nodeCenterY = 74.68 * $scale
    
    # Outer glow of node
    $nodeAuraBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(120, 126, 184, 247))
    $nodeAuraR = 5.0 * $scale
    $g.FillEllipse($nodeAuraBrush, ($nodeCenterX - $nodeAuraR), ($nodeCenterY - $nodeAuraR), ($nodeAuraR * 2), ($nodeAuraR * 2))

    # Solid node
    $nodeBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 126, 184, 247))
    $nodeR = 3.2 * $scale
    $g.FillEllipse($nodeBrush, ($nodeCenterX - $nodeR), ($nodeCenterY - $nodeR), ($nodeR * 2), ($nodeR * 2))

    # White gleaming center
    $nodeCenterBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
    $nodeCoreR = 1.6 * $scale
    $g.FillEllipse($nodeCenterBrush, ($nodeCenterX - $nodeCoreR), ($nodeCenterY - $nodeCoreR), ($nodeCoreR * 2), ($nodeCoreR * 2))

    # 5. Center Motif: Modern Victory Checkmark & Sparkle
    # Soft Sky Blue Glow behind tick
    $tickGlowPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(110, 126, 184, 247)), (8.5 * $scale)
    $tickGlowPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $tickGlowPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $tickGlowPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

    $tickPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $tickPath.AddLine((44.5 * $scale), (53.5 * $scale), (51.5 * $scale), (60.5 * $scale))
    $tickPath.AddLine((51.5 * $scale), (60.5 * $scale), (65.5 * $scale), (44.5 * $scale))
    $g.DrawPath($tickGlowPen, $tickPath)

    # Pastel Sky Blue Base Tick
    $tickBasePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 126, 184, 247)), (5.5 * $scale)
    $tickBasePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $tickBasePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $tickBasePen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $g.DrawPath($tickBasePen, $tickPath)

    # Pure White Crisp Center Tick Core
    $tickWhitePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White), (2.8 * $scale)
    $tickWhitePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $tickWhitePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $tickWhitePen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $g.DrawPath($tickWhitePen, $tickPath)

    # 6. Ethereal Top-Right Sparkle Star
    $starBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
    $starCenter = New-Object System.Drawing.PointF (68 * $scale), (32 * $scale)
    $sLen = 3.5 * $scale
    $sWid = 1.0 * $scale
    $starPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $starPath.AddPolygon(@(
        (New-Object System.Drawing.PointF $starCenter.X, ($starCenter.Y - $sLen)),
        (New-Object System.Drawing.PointF ($starCenter.X + $sWid), $starCenter.Y),
        (New-Object System.Drawing.PointF $starCenter.X, ($starCenter.Y + $sLen)),
        (New-Object System.Drawing.PointF ($starCenter.X - $sWid), $starCenter.Y)
    ))
    $g.FillPath($starBrush, $starPath)
    $starPathH = New-Object System.Drawing.Drawing2D.GraphicsPath
    $starPathH.AddPolygon(@(
        (New-Object System.Drawing.PointF ($starCenter.X - $sLen), $starCenter.Y),
        (New-Object System.Drawing.PointF $starCenter.X, ($starCenter.Y + $sWid)),
        (New-Object System.Drawing.PointF ($starCenter.X + $sLen), $starCenter.Y),
        (New-Object System.Drawing.PointF $starCenter.X, ($starCenter.Y - $sWid))
    ))
    $g.FillPath($starBrush, $starPathH)

    # Save to destination
    $dir = Split-Path -Parent $OutputPath
    if (!(Test-Path $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    $bmp.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Generated: $OutputPath ($Size x $Size)"
}

Write-Host "Generating DayByDay Modern Habit Ring & Victory Checkmark icons..."

# 1. iOS Universal AppIcon (1024 x 1024)
Draw-DayByDayIcon -Size 1024 -Type "square" -OutputPath "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"

# 2. Web & PWA Icon (512 x 512 & 192 x 192)
Draw-DayByDayIcon -Size 512 -Type "square" -OutputPath "public/icon.png"
Draw-DayByDayIcon -Size 192 -Type "square" -OutputPath "public/icon-192.png"

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
    Draw-DayByDayIcon -Size $d.LauncherSize -Type "square" -OutputPath "$dir/ic_launcher.png"
    Draw-DayByDayIcon -Size $d.LauncherSize -Type "round" -OutputPath "$dir/ic_launcher_round.png"
    Draw-DayByDayIcon -Size $d.ForeSize -Type "foreground" -OutputPath "$dir/ic_launcher_foreground.png"
}

Write-Host "All DayByDay icons generated successfully!"
