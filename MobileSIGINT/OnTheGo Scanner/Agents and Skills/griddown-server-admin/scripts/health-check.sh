#!/bin/bash
# GridDown Server Health Check Script
# Performs comprehensive health verification

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ERRORS=0

check_pass() {
    echo -e "  ${GREEN}✓${NC} $1"
}

check_fail() {
    echo -e "  ${RED}✗${NC} $1"
    ((ERRORS++))
}

check_warn() {
    echo -e "  ${YELLOW}!${NC} $1"
}

header() {
    echo -e "\n${BLUE}=== $1 ===${NC}"
}

# System Health
header "System Health"

# CPU Temperature
if command -v vcgencmd &>/dev/null; then
    TEMP=$(vcgencmd measure_temp | grep -oP '\d+\.\d+')
    if (( $(echo "$TEMP < 70" | bc -l) )); then
        check_pass "CPU Temperature: ${TEMP}°C"
    elif (( $(echo "$TEMP < 80" | bc -l) )); then
        check_warn "CPU Temperature: ${TEMP}°C (elevated)"
    else
        check_fail "CPU Temperature: ${TEMP}°C (critical)"
    fi
else
    check_warn "vcgencmd not available (not a Raspberry Pi?)"
fi

# Throttling
if command -v vcgencmd &>/dev/null; then
    THROTTLED=$(vcgencmd get_throttled | cut -d= -f2)
    if [[ "$THROTTLED" == "0x0" ]]; then
        check_pass "Throttling: None"
    else
        check_fail "Throttling detected: $THROTTLED"
    fi
fi

# Memory
MEM_TOTAL=$(free -m | awk '/^Mem:/{print $2}')
MEM_USED=$(free -m | awk '/^Mem:/{print $3}')
MEM_PCT=$((MEM_USED * 100 / MEM_TOTAL))
if [[ $MEM_PCT -lt 80 ]]; then
    check_pass "Memory: ${MEM_USED}MB / ${MEM_TOTAL}MB (${MEM_PCT}%)"
elif [[ $MEM_PCT -lt 90 ]]; then
    check_warn "Memory: ${MEM_USED}MB / ${MEM_TOTAL}MB (${MEM_PCT}%)"
else
    check_fail "Memory: ${MEM_USED}MB / ${MEM_TOTAL}MB (${MEM_PCT}%)"
fi

# Disk
DISK_PCT=$(df -h / | awk 'NR==2{gsub("%",""); print $5}')
DISK_AVAIL=$(df -h / | awk 'NR==2{print $4}')
if [[ $DISK_PCT -lt 80 ]]; then
    check_pass "Disk: ${DISK_PCT}% used (${DISK_AVAIL} free)"
elif [[ $DISK_PCT -lt 90 ]]; then
    check_warn "Disk: ${DISK_PCT}% used (${DISK_AVAIL} free)"
else
    check_fail "Disk: ${DISK_PCT}% used (${DISK_AVAIL} free)"
fi

# Docker Services
header "Docker Services"

if ! command -v docker &>/dev/null; then
    check_fail "Docker not installed"
else
    # Check if docker compose is available
    if docker compose version &>/dev/null; then
        # Get service status
        while IFS= read -r line; do
            SERVICE=$(echo "$line" | awk '{print $1}')
            STATE=$(echo "$line" | awk '{print $2}')
            STATUS=$(echo "$line" | awk '{print $3}')
            
            if [[ "$STATE" == "running" ]]; then
                check_pass "$SERVICE: $STATE"
            else
                check_fail "$SERVICE: $STATE ($STATUS)"
            fi
        done < <(docker compose ps --format "{{.Name}} {{.State}} {{.Status}}" 2>/dev/null || echo "")
    else
        check_warn "Docker Compose not available"
    fi
fi

# HTTP Endpoints
header "HTTP Endpoints"

check_endpoint() {
    local url=$1
    local name=$2
    local response
    
    if response=$(curl -sf -m 5 "$url" 2>/dev/null); then
        check_pass "$name ($url)"
    else
        check_fail "$name ($url)"
    fi
}

check_endpoint "http://localhost/health" "Health endpoint"
check_endpoint "http://localhost/status" "Status endpoint"

# Optional services (don't fail if not present)
if curl -sf -m 2 "http://localhost/library/" &>/dev/null; then
    check_pass "Kiwix (/library)"
fi

if curl -sf -m 2 "http://localhost/books/" &>/dev/null; then
    check_pass "Calibre-Web (/books)"
fi

if curl -sf -m 2 "http://localhost/files/" &>/dev/null; then
    check_pass "FileBrowser (/files)"
fi

# Database Health
header "Database Health"

BULLETIN_DB="data/bulletin/bulletin.db"
if [[ -f "$BULLETIN_DB" ]]; then
    # Check integrity
    INTEGRITY=$(sqlite3 "$BULLETIN_DB" "PRAGMA integrity_check;" 2>/dev/null || echo "error")
    if [[ "$INTEGRITY" == "ok" ]]; then
        check_pass "Database integrity: OK"
    else
        check_fail "Database integrity: $INTEGRITY"
    fi
    
    # Check WAL mode
    JOURNAL=$(sqlite3 "$BULLETIN_DB" "PRAGMA journal_mode;" 2>/dev/null || echo "unknown")
    if [[ "$JOURNAL" == "wal" ]]; then
        check_pass "Journal mode: WAL"
    else
        check_warn "Journal mode: $JOURNAL (expected: wal)"
    fi
    
    # Check for locks
    if fuser "$BULLETIN_DB" &>/dev/null; then
        PIDS=$(fuser "$BULLETIN_DB" 2>/dev/null)
        check_pass "Database in use by: $PIDS"
    else
        check_pass "Database not locked"
    fi
else
    check_warn "Database not found: $BULLETIN_DB"
fi

# Summary
header "Summary"

if [[ $ERRORS -eq 0 ]]; then
    echo -e "${GREEN}All checks passed!${NC}"
    exit 0
else
    echo -e "${RED}${ERRORS} check(s) failed${NC}"
    exit 1
fi
