# DayByDay Custom Flame & Glowing Orbit Rings Icon Generator (Sunset & Crimson)
Add-Type -AssemblyName System.Drawing

function Draw-FlameIcon {
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
        $g.Clear([System.Drawing.Color]::Transparent)
        $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
            (New-Object System.Drawing.PointF 0, 0),
            (New-Object System.Drawing.PointF $Size, $Size),
            [System.Drawing.Color]::FromArgb(255, 10, 18, 36),  # Obsidian Midnight Navy
            [System.Drawing.Color]::FromArgb(255, 2, 5, 12)     # Deep Midnight Obsidian
        )

        if ($Type -eq "round") {
            $g.FillEllipse($bgBrush, 2, 2, ($Size - 4), ($Size - 4))
            $borderPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(45, 249, 115, 22)), (1.5 * $scale)
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
            $borderPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(45, 249, 115, 22)), (1.5 * $scale)
            $g.DrawPath($borderPen, $path)
        }

        # Ambient Glow behind Flame (Sunset Orange & Crimson Aura)
        $glowBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(50, 249, 115, 22))
        $glowR = 38.0 * $scale
        $g.FillEllipse($glowBrush, ($Size/2 - $glowR), ($Size/2 - $glowR), ($glowR * 2), ($glowR * 2))

        $glowInner = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(40, 225, 29, 72))
        $glowInnerR = 24.0 * $scale
        $g.FillEllipse($glowInner, ($Size/2 - $glowInnerR), ($Size/2 - $glowInnerR), ($glowInnerR * 2), ($glowInnerR * 2))
    }

    # 1. Glowing Momentum Orbit Ring Arc (Sunset Orange to Crimson)
    $arcBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
        (New-Object System.Drawing.PointF (22 * $scale), (22 * $scale)),
        (New-Object System.Drawing.PointF (86 * $scale), (86 * $scale)),
        [System.Drawing.Color]::FromArgb(255, 249, 115, 22), # Sunset Orange
        [System.Drawing.Color]::FromArgb(255, 255, 42, 85)   # Crimson Red
    )
    $arcPen = New-Object System.Drawing.Pen ($arcBrush), (4.6 * $scale)
    $arcPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $arcPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $ringRect = New-Object System.Drawing.RectangleF (23 * $scale), (23 * $scale), (62 * $scale), (62 * $scale)
    $g.DrawArc($arcPen, $ringRect, 45, 260)

    # Momentum Orbit Glow Node
    $nodeCenter = New-Object System.Drawing.PointF (77.5 * $scale), (34 * $scale)
    $nodeR = 3.6 * $scale
    $nodeGlowBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(180, 255, 237, 213))
    $g.FillEllipse($nodeGlowBrush, ($nodeCenter.X - $nodeR * 1.4), ($nodeCenter.Y - $nodeR * 1.4), ($nodeR * 2.8), ($nodeR * 2.8))
    $nodeBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 251, 235))
    $g.FillEllipse($nodeBrush, ($nodeCenter.X - $nodeR), ($nodeCenter.Y - $nodeR), ($nodeR * 2), ($nodeR * 2))
    $nodeCenterBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
    $g.FillEllipse($nodeCenterBrush, ($nodeCenter.X - 1.5 * $scale), ($nodeCenter.Y - 1.5 * $scale), (3.0 * $scale), (3.0 * $scale))

    # 2. SIGNATURE FLAME CENTERPIECE
    $flamePath = New-Object System.Drawing.Drawing2D.GraphicsPath

    # Accurate DayByDay iconic flame contour
    $p1 = New-Object System.Drawing.PointF (54 * $scale), (28 * $scale)   # Apex tip
    $p2 = New-Object System.Drawing.PointF (56 * $scale), (36 * $scale)
    $p3 = New-Object System.Drawing.PointF (63 * $scale), (43 * $scale)
    $p4 = New-Object System.Drawing.PointF (69 * $scale), (52 * $scale)   # Right shoulder
    $p5 = New-Object System.Drawing.PointF (71 * $scale), (62 * $scale)   # Right flank
    $p6 = New-Object System.Drawing.PointF (66 * $scale), (72 * $scale)   # Right base
    $p7 = New-Object System.Drawing.PointF (54 * $scale), (76 * $scale)   # Bottom center
    $p8 = New-Object System.Drawing.PointF (42 * $scale), (72 * $scale)   # Left base
    $p9 = New-Object System.Drawing.PointF (37 * $scale), (62 * $scale)   # Left flank
    $p10 = New-Object System.Drawing.PointF (39 * $scale), (52 * $scale)  # Left indent
    $p11 = New-Object System.Drawing.PointF (45 * $scale), (54 * $scale)  # Left inner curve
    $p12 = New-Object System.Drawing.PointF (49 * $scale), (48 * $scale)  # Inner swirl crest
    $p13 = New-Object System.Drawing.PointF (50 * $scale), (41 * $scale)  # Inner swirl tuck
    $p14 = New-Object System.Drawing.PointF (52 * $scale), (34 * $scale)  # Upward spine

    # Draw smooth spline through flame contour
    $flamePoints = @($p1, $p2, $p3, $p4, $p5, $p6, $p7, $p8, $p9, $p10, $p11, $p12, $p13, $p14)
    $flamePath.AddClosedCurve($flamePoints, 0.45)

    # Flame Fill Gradient (Warm golden yellow to glowing crimson)
    $flameFillBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
        (New-Object System.Drawing.PointF (54 * $scale), (28 * $scale)),
        (New-Object System.Drawing.PointF (54 * $scale), (76 * $scale)),
        [System.Drawing.Color]::FromArgb(255, 255, 170, 60), # Bright golden amber
        [System.Drawing.Color]::FromArgb(255, 225, 29, 72)   # Deep crimson red
    )
    $g.FillPath($flameFillBrush, $flamePath)

    # Flame Outer Stroke with subtle soft highlight
    $flameOutlinePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 255, 240, 210)), (2.4 * $scale)
    $flameOutlinePen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $g.DrawPath($flameOutlinePen, $flamePath)

    # 3. Inner Core Glowing Ember
    $emberPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $ep1 = New-Object System.Drawing.PointF (54 * $scale), (46 * $scale)
    $ep2 = New-Object System.Drawing.PointF (61 * $scale), (54 * $scale)
    $ep3 = New-Object System.Drawing.PointF (63 * $scale), (63 * $scale)
    $ep4 = New-Object System.Drawing.PointF (54 * $scale), (70 * $scale)
    $ep5 = New-Object System.Drawing.PointF (45 * $scale), (63 * $scale)
    $ep6 = New-Object System.Drawing.PointF (47 * $scale), (54 * $scale)
    $emberPoints = @($ep1, $ep2, $ep3, $ep4, $ep5, $ep6)
    $emberPath.AddClosedCurve($emberPoints, 0.5)

    $emberBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
        (New-Object System.Drawing.PointF (54 * $scale), (46 * $scale)),
        (New-Object System.Drawing.PointF (54 * $scale), (70 * $scale)),
        [System.Drawing.Color]::FromArgb(240, 255, 255, 255), # White-hot core
        [System.Drawing.Color]::FromArgb(200, 255, 150, 40)   # Golden orange
    )
    $g.FillPath($emberBrush, $emberPath)

    # 4. White-Hot Sparkle Star Node
    $sparklePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 254, 240, 138)), (1.6 * $scale)
    $sparklePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $sparklePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $sc = New-Object System.Drawing.PointF (31 * $scale), (37 * $scale)
    $sLen = 4.5 * $scale
    $g.DrawLine($sparklePen, $sc.X, ($sc.Y - $sLen), $sc.X, ($sc.Y + $sLen))
    $g.DrawLine($sparklePen, ($sc.X - $sLen), $sc.Y, ($sc.X + $sLen), $sc.Y)
    $whiteDotBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
    $g.FillEllipse($whiteDotBrush, ($sc.X - 1.2 * $scale), ($sc.Y - 1.2 * $scale), (2.4 * $scale), (2.4 * $scale))

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

Write-Host "Generating DayByDay Sunset Flame Icons..."

# 1. iOS Universal AppIcon (1024 x 1024)
Draw-FlameIcon -Size 1024 -Type "square" -OutputPath "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"

# 2. Web & PWA Icons (512 x 512 & 192 x 192)
Draw-FlameIcon -Size 512 -Type "square" -OutputPath "public/icon.png"
Draw-FlameIcon -Size 192 -Type "square" -OutputPath "public/icon-192.png"

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
    Draw-FlameIcon -Size $d.LauncherSize -Type "square" -OutputPath "$dir/ic_launcher.png"
    Draw-FlameIcon -Size $d.LauncherSize -Type "round" -OutputPath "$dir/ic_launcher_round.png"
    Draw-FlameIcon -Size $d.ForeSize -Type "foreground" -OutputPath "$dir/ic_launcher_foreground.png"
}

Write-Host "All DayByDay Sunset Flame icons generated successfully!"
