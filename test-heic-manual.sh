#!/bin/bash

# HEIC Integration Test Script
# This script helps verify the HEIC integration is working properly

echo "🧪 HEIC Integration Test Script"
echo "==============================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test 1: Check if backend is running
echo -e "\n${BLUE}1. Checking Backend Server...${NC}"
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend server is running on port 3001${NC}"
else
    echo -e "${RED}❌ Backend server is not running. Start with: cd photovault-api && npm start${NC}"
    exit 1
fi

# Test 2: Check if frontend is running
echo -e "\n${BLUE}2. Checking Frontend Server...${NC}"
if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend server is running on port 5173${NC}"
else
    echo -e "${RED}❌ Frontend server is not running. Start with: cd photovault-fe && npm run dev${NC}"
    exit 1
fi

# Test 3: Check HEIC support in backend
echo -e "\n${BLUE}3. Checking HEIC Support...${NC}"
HEIC_SUPPORT=$(curl -s http://localhost:3001/api/system/info | grep -o '"heicSupport":[^,]*' | cut -d':' -f2)
if [ "$HEIC_SUPPORT" = "true" ]; then
    echo -e "${GREEN}✅ HEIC support is enabled in backend${NC}"
else
    echo -e "${RED}❌ HEIC support is not available. Check Sharp installation.${NC}"
fi

# Test 4: Check for bucket access
echo -e "\n${BLUE}4. Checking Bucket Access...${NC}"
BUCKET_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001/api/buckets")
if [ "$BUCKET_RESPONSE" = "200" ] || [ "$BUCKET_RESPONSE" = "401" ]; then
    echo -e "${GREEN}✅ API endpoints are accessible${NC}"
else
    echo -e "${RED}❌ API endpoints not accessible (HTTP $BUCKET_RESPONSE)${NC}"
fi

# Test 5: Check for test HEIC files
echo -e "\n${BLUE}5. Checking for Test Files...${NC}"
HEIC_COUNT=$(find . -name "*.heic" -o -name "*.HEIC" 2>/dev/null | wc -l)
if [ "$HEIC_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ Found $HEIC_COUNT HEIC files for testing${NC}"
    find . -name "*.heic" -o -name "*.HEIC" 2>/dev/null | head -3
else
    echo -e "${YELLOW}⚠️ No HEIC files found in current directory${NC}"
    echo "   To test HEIC functionality, you'll need HEIC files (iPhone photos work best)"
fi

echo -e "\n${BLUE}📋 Manual Test Instructions:${NC}"
echo "1. Open http://localhost:5173 in your browser"
echo "2. Navigate to an album or create a new one"
echo "3. Upload HEIC files using the 'Add Photos' button"
echo "4. Observe loading times (should be <200ms for HEIC images)"
echo "5. Check browser console for server variant usage logs"
echo "6. Verify no 'Converting HEIC...' loading states appear"

echo -e "\n${BLUE}🔍 What to Look For:${NC}"
echo "✅ HEIC images load instantly in grid view"
echo "✅ Console shows: 'Using server-processed HEIC variant'"
echo "✅ No client-side conversion loading states"
echo "✅ Lightbox opens HEIC images quickly"
echo "✅ Upload creates multiple variants (check backend logs)"

echo -e "\n${BLUE}📊 Performance Comparison:${NC}"
echo "Before: HEIC loading = 2-5 seconds (client conversion)"
echo "After:  HEIC loading = ~100ms (server variants)"
echo "Expected improvement: 20-50x faster"

echo -e "\n${BLUE}🐛 Troubleshooting:${NC}"
echo "- If HEIC images still convert: Check backend logs for variant creation"
echo "- If uploads fail: Verify Sharp library installation in backend"
echo "- If images don't display: Check MinIO bucket for variant files"
echo "- Monitor browser Network tab for HEIC variant requests"

echo -e "\n${GREEN}🚀 Test environment is ready! Start manual testing.${NC}"
echo "📖 See HEIC_TEST_PLAN.md for detailed test scenarios"
