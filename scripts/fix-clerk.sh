#!/bin/bash

# Clerk Setup Diagnostic and Fix Script

echo "🔍 Clerk Configuration Diagnostic"
echo "=================================="
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found"
    echo "   Creating .env from .env.example..."
    cp .env.example .env
    echo "✅ .env created. Please update it with your Clerk keys."
    exit 1
fi

echo "✅ .env file found"
echo ""

# Extract Clerk keys
CLERK_PUB=$(grep "^NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=" .env | cut -d'=' -f2 | tr -d '"')
CLERK_SEC=$(grep "^CLERK_SECRET_KEY=" .env | cut -d'=' -f2 | tr -d '"')

echo "📋 Current Configuration:"
echo "   Publishable Key: ${CLERK_PUB:0:20}..."
echo "   Secret Key: ${CLERK_SEC:0:20}..."
echo ""

# Check key types
if [[ $CLERK_PUB == pk_test_* ]]; then
    echo "✅ Using TEST keys (development mode)"
elif [[ $CLERK_PUB == pk_live_* ]]; then
    echo "⚠️  Using LIVE keys (production mode)"
    echo "   Note: Live keys require proper domain configuration"
else
    echo "❌ Invalid publishable key format"
    echo "   Should start with pk_test_ or pk_live_"
    exit 1
fi

echo ""
echo "🔧 Options to Fix:"
echo ""
echo "1. Use Test Keys (Recommended for Development)"
echo "   - Go to https://dashboard.clerk.com"
echo "   - Copy your test keys (pk_test_...)"
echo "   - Update .env with the test keys"
echo ""
echo "2. Fix Custom Domain Setup"
echo "   - Go to https://dashboard.clerk.com → Settings → Domains"
echo "   - Add your custom domain"
echo "   - Complete DNS verification"
echo "   - Set as primary domain"
echo ""
echo "3. Check Current Domain"
SITE_URL=$(grep "^NEXT_PUBLIC_SITE_URL=" .env | cut -d'=' -f2 | tr -d '"')
echo "   Current Site URL: $SITE_URL"
echo ""

if [[ $CLERK_PUB == pk_live_* ]] && [[ -z "$SITE_URL" ]]; then
    echo "❌ ERROR: Using LIVE keys but NEXT_PUBLIC_SITE_URL not set"
    echo "   Please set NEXT_PUBLIC_SITE_URL to your domain"
    exit 1
fi

echo "✅ Configuration check complete"
echo ""
echo "Next steps:"
echo "1. If using test keys: npm run dev"
echo "2. If using live keys: verify domain setup in Clerk dashboard"
echo "3. Clear browser cache and hard refresh"
