#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Setup Cloudflare Email Routing rules for cleengine.systems
    Forwards inquiries@ and averi@ to inquiries@creativeliberationengine.org

.USAGE
    $env:CF_API_TOKEN = "your-token-here"
    .\setup-email-routing.ps1
    
.TOKEN PERMISSIONS REQUIRED
    Zone:Email Routing:Edit  (for cleengine.systems zone)
    
.CREATE TOKEN AT
    https://dash.cloudflare.com/profile/api-tokens
    → Create Token → Create Custom Token
    → Permissions: Zone | Email Routing | Edit
    → Zone Resources: Include | Specific zone | cleengine.systems
#>

$TOKEN = $env:CF_API_TOKEN
if (-not $TOKEN) {
    Write-Error "Set CF_API_TOKEN environment variable first."
    Write-Host "Get token at: https://dash.cloudflare.com/profile/api-tokens"
    Write-Host "Permissions: Zone:Email Routing:Edit for cleengine.systems"
    exit 1
}

$ZONE_ID    = "9c38dfc13a30d892f5f94764131d112e"
$ACCOUNT_ID = "8d718b480ea7c11a85e6f99bd12ad7af"
$DEST_EMAIL = "inquiries@creativeliberationengine.org"
$H = @{ "Authorization" = "Bearer $TOKEN"; "Content-Type" = "application/json" }
$BASE = "https://api.cloudflare.com/client/v4"

function CF-Call($method, $uri, $body = $null) {
    $params = @{ Method = $method; Uri = "$BASE$uri"; Headers = $H }
    if ($body) { $params.Body = ($body | ConvertTo-Json -Depth 10) }
    try {
        return Invoke-RestMethod @params
    } catch {
        $err = $_.Exception.Response
        Write-Host "ERROR $method $uri → $($err.StatusCode): $($_.ErrorDetails.Message)"
        return $null
    }
}

Write-Host ""
Write-Host "══════════════════════════════════════════════════"
Write-Host "  Creative Liberation Engine — Email Routing Setup"
Write-Host "  Domain: cleengine.systems"
Write-Host "══════════════════════════════════════════════════"

# 1. Check/enable email routing
Write-Host "`n[1/5] Checking Email Routing status..."
$status = CF-Call "GET" "/zones/$ZONE_ID/email/routing"
if ($status) {
    $enabled = $status.result.enabled
    Write-Host "  Email Routing enabled: $enabled"
    if (-not $enabled) {
        Write-Host "  Enabling Email Routing..."
        CF-Call "POST" "/zones/$ZONE_ID/email/routing/enable" | Out-Null
        Write-Host "  ✓ Enabled"
    }
}

# 2. Ensure inquiries@creativeliberationengine.org is a verified destination address
Write-Host "`n[2/5] Checking destination address: $DEST_EMAIL"
$dests = CF-Call "GET" "/accounts/$ACCOUNT_ID/email/routing/addresses"
$existing = $dests.result | Where-Object { $_.email -eq $DEST_EMAIL }

if ($existing) {
    Write-Host "  Found: $DEST_EMAIL — verified: $($existing.verified)"
    if (-not $existing.verified) {
        Write-Host "  ⚠️  Address NOT verified. Check Gmail for a Cloudflare verification email and click the link."
        Write-Host "  (Forwarding rules will be created but won't work until verified)"
    } else {
        Write-Host "  ✓ Verified"
    }
} else {
    Write-Host "  Creating destination address: $DEST_EMAIL"
    $newDest = CF-Call "POST" "/accounts/$ACCOUNT_ID/email/routing/addresses" @{ email = $DEST_EMAIL }
    if ($newDest.result) {
        Write-Host "  ✓ Created — CHECK GMAIL for a verification email from Cloudflare and click the link!"
    }
}

# 3. Get existing rules to avoid duplicates
Write-Host "`n[3/5] Checking existing routing rules..."
$rules = CF-Call "GET" "/zones/$ZONE_ID/email/routing/rules"
$existingRules = $rules.result
Write-Host "  Found $($existingRules.Count) existing rules:"
$existingRules | ForEach-Object {
    $matcher = $_.matchers[0]
    $action  = $_.actions[0]
    Write-Host "    [$($_.name)] $($matcher.type)=$($matcher.value) → $($action.type)=$($action.value -join ',')"
}

# 4. Create rules for inquiries@ and averi@
$addresses = @("inquiries", "averi")
Write-Host "`n[4/5] Creating forwarding rules..."

foreach ($addr in $addresses) {
    $email = "$addr@cleengine.systems"
    # Check if rule already exists
    $dupe = $existingRules | Where-Object { $_.matchers[0].value -eq $email }
    if ($dupe) {
        Write-Host "  ↩  Rule already exists for $email (skipping)"
        continue
    }

    $ruleBody = @{
        name     = "Forward $addr to Gmail"
        enabled  = $true
        priority = 10
        matchers = @(@{ type = "literal"; field = "to"; value = $email })
        actions  = @(@{ type = "forward"; value = @($DEST_EMAIL) })
    }

    $result = CF-Call "POST" "/zones/$ZONE_ID/email/routing/rules" $ruleBody
    if ($result.result) {
        Write-Host "  ✓ Created rule: $email → $DEST_EMAIL"
    } else {
        Write-Host "  ✗ Failed to create rule for $email"
    }
}

# 5. Status summary
Write-Host "`n[5/5] Final state:"
$finalRules = CF-Call "GET" "/zones/$ZONE_ID/email/routing/rules"
$finalRules.result | ForEach-Object {
    $m = $_.matchers[0]; $a = $_.actions[0]
    $flag = if ($_.enabled) { "✓" } else { "✗" }
    Write-Host "  $flag [$($_.priority)] $($m.type)=$($m.value) → $($a.type)=[$($a.value -join ',')]"
}

Write-Host ""
Write-Host "══════════════════════════════════════════════════"
Write-Host "  DONE. Emails to inquiries@ and averi@ will"
Write-Host "  forward to $DEST_EMAIL"
Write-Host ""
Write-Host "  NEXT — Outbound (send AS those addresses):"
Write-Host "  Run: npx wrangler secret put MAILCHANNELS_API_KEY"
Write-Host "  Sign up (free 100/day): https://mailchannels.com"
Write-Host "══════════════════════════════════════════════════"
