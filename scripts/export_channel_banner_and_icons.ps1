# DayByDay Premium App Icon & Channel Banner Exporter
# Generates high-res icons (transparent, squircle, circular) and professional channel banners

Add-Type -AssemblyName System.Drawing

$outputDir = "assets/extracted_icon"
if (!(Test-Path $outputDir)) {
    New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
}

$artifactDir = "C:\Users\palak\.gemini\antigravity-ide\brain\7a8a5a4a-1208-4be3-93db-340bdecf4cde\extracted_icon"
if (!(Test-Path $artifactDir)) {
    New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null
}

function Save-ImageCopies {
    param(
        [System.Drawing.Bitmap]$Bmp,
        [string]$Filename
    )
    $dest1 = Join-Path $outputDir $Filename
    $dest2 = Join-Path $artifactDir $Filename
    $Bmp.Save($dest1, [System.Drawing.Imaging.ImageFormat]::Png)
    $Bmp.Save($dest2, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Host "Saved: $Filename ($($Bmp.Width)x$($Bmp.Height))"
}

# 1. Base Flame Drawer function
function Draw-FlameEmblem {
    param(
        [System.Drawing.Graphics]$g,
        [float]$CenterX,
        [float]$CenterY,
        [float]$Radius,      # Outer radius of the emblem (relative to 54 in 108dp canvas)
        [bool]$DrawBackdrop = $false
    )
    $scale = $Radius / 45.0
    $originX = $CenterX - (54.0 * $scale)
    $originY = $CenterY - (54.0 * $scale)

    $state = $g.Save()
    $g.TranslateTransform($originX, $originY)

    if ($DrawBackdrop) {
        # Ambient Glow behind Flame (Sunset Orange & Crimson Aura)
        $glowBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(65, 249, 115, 22))
        $glowR = 38.0 * $scale
        $g.FillEllipse($glowBrush, (54 * $scale - $glowR), (54 * $scale - $glowR), ($glowR * 2), ($glowR * 2))

        $glowInner = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(50, 225, 29, 72))
        $glowInnerR = 24.0 * $scale
        $g.FillEllipse($glowInner, (54 * $scale - $glowInnerR), (54 * $scale - $glowInnerR), ($glowInnerR * 2), ($glowInnerR * 2))
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

    $flamePoints = @($p1, $p2, $p3, $p4, $p5, $p6, $p7, $p8, $p9, $p10, $p11, $p12, $p13, $p14)
    $flamePath.AddClosedCurve($flamePoints, 0.45)

    $flameFillBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
        (New-Object System.Drawing.PointF (54 * $scale), (28 * $scale)),
        (New-Object System.Drawing.PointF (54 * $scale), (76 * $scale)),
        [System.Drawing.Color]::FromArgb(255, 255, 170, 60),
        [System.Drawing.Color]::FromArgb(255, 225, 29, 72)
    )
    $g.FillPath($flameFillBrush, $flamePath)

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
        [System.Drawing.Color]::FromArgb(240, 255, 255, 255),
        [System.Drawing.Color]::FromArgb(200, 255, 150, 40)
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

    $g.Restore($state)
}

# --- 1. 1024x1024 Transparent PNG (Emblem only) ---
$bmpTrans = New-Object System.Drawing.Bitmap 1024, 1024
$gTrans = [System.Drawing.Graphics]::FromImage($bmpTrans)
$gTrans.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$gTrans.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gTrans.Clear([System.Drawing.Color]::Transparent)
Draw-FlameEmblem -g $gTrans -CenterX 512 -CenterY 512 -Radius 430 -DrawBackdrop $false
Save-ImageCopies -Bmp $bmpTrans -Filename "DayByDay_Icon_Transparent_1024x1024.png"
$gTrans.Dispose()
$bmpTrans.Dispose()

# --- 2. 1024x1024 Squircle App Icon ---
$source1024 = "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"
if (Test-Path $source1024) {
    Copy-Item $source1024 (Join-Path $outputDir "DayByDay_AppIcon_1024x1024.png") -Force
    Copy-Item $source1024 (Join-Path $artifactDir "DayByDay_AppIcon_1024x1024.png") -Force
    Write-Host "Extracted: DayByDay_AppIcon_1024x1024.png"
}

# --- 3. 512x512 App Icon & Vector SVG ---
$source512 = "public/icon.png"
if (Test-Path $source512) {
    Copy-Item $source512 (Join-Path $outputDir "DayByDay_AppIcon_512x512.png") -Force
    Copy-Item $source512 (Join-Path $artifactDir "DayByDay_AppIcon_512x512.png") -Force
    Write-Host "Extracted: DayByDay_AppIcon_512x512.png"
}
$sourceSvg = "public/icon.svg"
if (Test-Path $sourceSvg) {
    Copy-Item $sourceSvg (Join-Path $outputDir "DayByDay_Icon.svg") -Force
    Copy-Item $sourceSvg (Join-Path $artifactDir "DayByDay_Icon.svg") -Force
    Write-Host "Extracted: DayByDay_Icon.svg"
}

# --- 4. 800x800 Circular Avatar / Profile Picture (Channel Avatar) ---
$bmpAvatar = New-Object System.Drawing.Bitmap 800, 800
$gAvatar = [System.Drawing.Graphics]::FromImage($bmpAvatar)
$gAvatar.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$gAvatar.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gAvatar.Clear([System.Drawing.Color]::Transparent)

# Circle background
$circleBg = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
    (New-Object System.Drawing.PointF 0, 0),
    (New-Object System.Drawing.PointF 800, 800),
    [System.Drawing.Color]::FromArgb(255, 10, 18, 36),
    [System.Drawing.Color]::FromArgb(255, 2, 5, 12)
)
$gAvatar.FillEllipse($circleBg, 4, 4, 792, 792)
$rimPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(60, 249, 115, 22)), 4
$gAvatar.DrawEllipse($rimPen, 4, 4, 792, 792)
Draw-FlameEmblem -g $gAvatar -CenterX 400 -CenterY 400 -Radius 300 -DrawBackdrop $true
Save-ImageCopies -Bmp $bmpAvatar -Filename "DayByDay_Avatar_Circle_800x800.png"
$gAvatar.Dispose()
$bmpAvatar.Dispose()


# Helper: bullet char safely constructed
$bullet = [char]0x2022

# --- 5. YouTube Channel Banner (2560 x 1440) ---
$wYT = 2560
$hYT = 1440
$bmpYT = New-Object System.Drawing.Bitmap $wYT, $hYT
$gYT = [System.Drawing.Graphics]::FromImage($bmpYT)
$gYT.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$gYT.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gYT.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

$bgYT = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
    (New-Object System.Drawing.PointF 0, 0),
    (New-Object System.Drawing.PointF $wYT, $hYT),
    [System.Drawing.Color]::FromArgb(255, 10, 18, 36),
    [System.Drawing.Color]::FromArgb(255, 2, 5, 12)
)
$gYT.FillRectangle($bgYT, 0, 0, $wYT, $hYT)

# Ambient Sunset Radial Bloom behind center safe area
$centerAuraPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$centerAuraPath.AddEllipse(($wYT/2 - 800), ($hYT/2 - 400), 1600, 800)
$auraBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush $centerAuraPath
$auraBrush.CenterColor = [System.Drawing.Color]::FromArgb(55, 249, 115, 22)
$auraBrush.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 10, 18, 36))
$gYT.FillPath($auraBrush, $centerAuraPath)

# Subtle orbit dashes
$bgRingPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(22, 249, 115, 22)), 3
$bgRingPen.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
$gYT.DrawEllipse($bgRingPen, ($wYT/2 - 500), ($hYT/2 - 500), 1000, 1000)

# Draw Logo Emblem in Safe Area (Center-Left: X=820, Y=720)
Draw-FlameEmblem -g $gYT -CenterX 830 -CenterY 720 -Radius 155 -DrawBackdrop $true

# Typography: "DayByDay" Title
$titleFont = New-Object System.Drawing.Font "Segoe UI", 90, 'Bold', 'Pixel'
$titleBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
$gYT.DrawString("DayByDay", $titleFont, $titleBrush, 1020, 610)

# Tagline
$subFont = New-Object System.Drawing.Font "Segoe UI", 27, 'Regular', 'Pixel'
$subBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(235, 253, 186, 116))
$gYT.DrawString("BUILD BETTER HABITS  $bullet  TOGETHER", $subFont, $subBrush, 1026, 732)

# Accent badge
$badgeFont = New-Object System.Drawing.Font "Segoe UI", 16, 'Bold', 'Pixel'
$badgeBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(180, 249, 115, 22))
$gYT.DrawString("STREAKS   |   HEALTH SYNC   |   CO-OP PODS", $badgeFont, $badgeBrush, 1028, 786)

Save-ImageCopies -Bmp $bmpYT -Filename "DayByDay_Channel_Banner_YouTube_2560x1440.png"
$gYT.Dispose()
$bmpYT.Dispose()


# --- 6. YouTube Centered Minimalist Banner (2560 x 1440) ---
$bmpYTCentered = New-Object System.Drawing.Bitmap $wYT, $hYT
$gYTC = [System.Drawing.Graphics]::FromImage($bmpYTCentered)
$gYTC.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$gYTC.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gYTC.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$gYTC.FillRectangle($bgYT, 0, 0, $wYT, $hYT)
$gYTC.FillPath($auraBrush, $centerAuraPath)

# Centered Emblem + Stacked Title
Draw-FlameEmblem -g $gYTC -CenterX ($wYT/2) -CenterY 640 -Radius 135 -DrawBackdrop $true

$sf = New-Object System.Drawing.StringFormat
$sf.Alignment = [System.Drawing.StringAlignment]::Center

$titleFontC = New-Object System.Drawing.Font "Segoe UI", 64, 'Bold', 'Pixel'
$gYTC.DrawString("DayByDay", $titleFontC, $titleBrush, ($wYT/2), 760, $sf)

$subFontC = New-Object System.Drawing.Font "Segoe UI", 22, 'Regular', 'Pixel'
$gYTC.DrawString("Build Better Habits  $bullet  One Day at a Time", $subFontC, $subBrush, ($wYT/2), 840, $sf)

Save-ImageCopies -Bmp $bmpYTCentered -Filename "DayByDay_Channel_Banner_YouTube_Centered_2560x1440.png"
$gYTC.Dispose()
$bmpYTCentered.Dispose()


# --- 7. YouTube Pure Emblem Banner (2560 x 1440) - Icon Only ---
$bmpYTEmblem = New-Object System.Drawing.Bitmap $wYT, $hYT
$gYTE = [System.Drawing.Graphics]::FromImage($bmpYTEmblem)
$gYTE.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$gYTE.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gYTE.FillRectangle($bgYT, 0, 0, $wYT, $hYT)
$gYTE.FillPath($auraBrush, $centerAuraPath)
$gYTE.DrawEllipse($bgRingPen, ($wYT/2 - 450), ($hYT/2 - 450), 900, 900)
Draw-FlameEmblem -g $gYTE -CenterX ($wYT/2) -CenterY 720 -Radius 180 -DrawBackdrop $true
Save-ImageCopies -Bmp $bmpYTEmblem -Filename "DayByDay_Channel_Banner_PureEmblem_2560x1440.png"
$gYTE.Dispose()
$bmpYTEmblem.Dispose()


# --- 8. Twitter / X Header Banner (1500 x 500) ---
$wTW = 1500
$hTW = 500
$bmpTW = New-Object System.Drawing.Bitmap $wTW, $hTW
$gTW = [System.Drawing.Graphics]::FromImage($bmpTW)
$gTW.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$gTW.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gTW.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

$bgTW = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
    (New-Object System.Drawing.PointF 0, 0),
    (New-Object System.Drawing.PointF $wTW, $hTW),
    [System.Drawing.Color]::FromArgb(255, 10, 18, 36),
    [System.Drawing.Color]::FromArgb(255, 2, 5, 12)
)
$gTW.FillRectangle($bgTW, 0, 0, $wTW, $hTW)

$twAuraPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$twAuraPath.AddEllipse(220, -50, 650, 600)
$twAuraBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush $twAuraPath
$twAuraBrush.CenterColor = [System.Drawing.Color]::FromArgb(50, 249, 115, 22)
$twAuraBrush.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 10, 18, 36))
$gTW.FillPath($twAuraBrush, $twAuraPath)

# Left emblem
Draw-FlameEmblem -g $gTW -CenterX 410 -CenterY 250 -Radius 125 -DrawBackdrop $true

# Title and subtitle
$twTitleFont = New-Object System.Drawing.Font "Segoe UI", 68, 'Bold', 'Pixel'
$gTW.DrawString("DayByDay", $twTitleFont, $titleBrush, 560, 160)

$twSubFont = New-Object System.Drawing.Font "Segoe UI", 22, 'Regular', 'Pixel'
$gTW.DrawString("Build Better Habits  $bullet  Together", $twSubFont, $subBrush, 566, 252)

$twBadgeFont = New-Object System.Drawing.Font "Segoe UI", 14, 'Bold', 'Pixel'
$gTW.DrawString("STREAKS   |   HEALTH SYNC   |   GROUP PODS", $twBadgeFont, $badgeBrush, 568, 296)

Save-ImageCopies -Bmp $bmpTW -Filename "DayByDay_Header_Twitter_1500x500.png"
$gTW.Dispose()
$bmpTW.Dispose()


# --- 9. Full HD 16:9 Banner (1920 x 1080) ---
$wHD = 1920
$hHD = 1080
$bmpHD = New-Object System.Drawing.Bitmap $wHD, $hHD
$gHD = [System.Drawing.Graphics]::FromImage($bmpHD)
$gHD.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$gHD.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gHD.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

$bgHD = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
    (New-Object System.Drawing.PointF 0, 0),
    (New-Object System.Drawing.PointF $wHD, $hHD),
    [System.Drawing.Color]::FromArgb(255, 10, 18, 36),
    [System.Drawing.Color]::FromArgb(255, 2, 5, 12)
)
$gHD.FillRectangle($bgHD, 0, 0, $wHD, $hHD)

$hdAuraPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$hdAuraPath.AddEllipse(($wHD/2 - 500), ($hHD/2 - 350), 1000, 700)
$hdAuraBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush $hdAuraPath
$hdAuraBrush.CenterColor = [System.Drawing.Color]::FromArgb(50, 249, 115, 22)
$hdAuraBrush.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 10, 18, 36))
$gHD.FillPath($hdAuraBrush, $hdAuraPath)

Draw-FlameEmblem -g $gHD -CenterX 650 -CenterY 540 -Radius 145 -DrawBackdrop $true
$hdTitleFont = New-Object System.Drawing.Font "Segoe UI", 80, 'Bold', 'Pixel'
$gHD.DrawString("DayByDay", $hdTitleFont, $titleBrush, 820, 445)
$hdSubFont = New-Object System.Drawing.Font "Segoe UI", 24, 'Regular', 'Pixel'
$gHD.DrawString("BUILD BETTER HABITS  $bullet  TOGETHER", $hdSubFont, $subBrush, 826, 550)
$hdBadgeFont = New-Object System.Drawing.Font "Segoe UI", 16, 'Bold', 'Pixel'
$gHD.DrawString("LIVE SYNC   |   HEALTH TRACKING   |   CO-OP PODS", $hdBadgeFont, $badgeBrush, 828, 595)

Save-ImageCopies -Bmp $bmpHD -Filename "DayByDay_Banner_1920x1080.png"
$gHD.Dispose()
$bmpHD.Dispose()

Write-Host "`nAll 9 app icons, avatars, and channel banners generated and extracted successfully!"
