#!/bin/bash

################################################################################
# On-the-Go RF Awareness Scanner - Setup Script
# Version: 1.0
# Platform: Ubuntu 20.04+ / Debian 11+
# 
# This script installs all required dependencies and configures services
# for the On-the-Go RF Awareness Scanner.
#
# Usage: sudo ./setup.sh
################################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}ERROR: This script must be run as root (use sudo)${NC}"
    exit 1
fi

# Get the actual user (not root)
ACTUAL_USER="${SUDO_USER:-$USER}"
ACTUAL_HOME=$(getent passwd "$ACTUAL_USER" | cut -d: -f6)

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}On-the-Go RF Awareness Scanner Setup${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Installing for user: ${GREEN}$ACTUAL_USER${NC}"
echo -e "Home directory: ${GREEN}$ACTUAL_HOME${NC}"
echo ""

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    OS_VERSION=$VERSION_ID
else
    echo -e "${RED}ERROR: Cannot detect OS${NC}"
    exit 1
fi

echo -e "Detected OS: ${GREEN}$OS $OS_VERSION${NC}"

# Verify supported OS
if [[ "$OS" != "ubuntu" && "$OS" != "debian" ]]; then
    echo -e "${YELLOW}WARNING: This script is designed for Ubuntu/Debian.${NC}"
    echo -e "${YELLOW}Your OS ($OS) may not be fully supported.${NC}"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

################################################################################
# 1. Update System Packages
################################################################################

echo ""
echo -e "${BLUE}[1/10] Updating system packages...${NC}"
apt-get update
apt-get upgrade -y

################################################################################
# 2. Install Basic Build Tools
################################################################################

echo ""
echo -e "${BLUE}[2/10] Installing build essentials...${NC}"
apt-get install -y \
    build-essential \
    git \
    curl \
    wget \
    ca-certificates \
    gnupg \
    lsb-release \
    software-properties-common \
    python3 \
    python3-pip

################################################################################
# 3. Install Node.js 18 LTS
################################################################################

echo ""
echo -e "${BLUE}[3/10] Installing Node.js 18 LTS...${NC}"

# Check if Node.js is already installed
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 18 ]; then
        echo -e "${GREEN}Node.js $NODE_VERSION is already installed${NC}"
    else
        echo -e "${YELLOW}Node.js $NODE_VERSION is installed but version 18+ is required${NC}"
        echo "Installing Node.js 18 LTS..."
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt-get install -y nodejs
    fi
else
    echo "Installing Node.js 18 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
fi

# Verify installation
NODE_VERSION=$(node -v)
NPM_VERSION=$(npm -v)
echo -e "${GREEN}Node.js: $NODE_VERSION${NC}"
echo -e "${GREEN}npm: $NPM_VERSION${NC}"

################################################################################
# 4. Install RTL-SDR Tools and Drivers
################################################################################

echo ""
echo -e "${BLUE}[4/10] Installing RTL-SDR tools and drivers...${NC}"

apt-get install -y \
    rtl-sdr \
    librtlsdr-dev \
    librtlsdr0

# Blacklist DVB-T drivers (they conflict with RTL-SDR)
if [ ! -f /etc/modprobe.d/blacklist-rtl.conf ]; then
    echo "Blacklisting DVB-T drivers..."
    cat > /etc/modprobe.d/blacklist-rtl.conf <<EOF
# Blacklist DVB-T drivers to allow RTL-SDR usage
blacklist dvb_usb_rtl28xxu
blacklist rtl2832
blacklist rtl2830
EOF
    echo -e "${GREEN}DVB-T drivers blacklisted${NC}"
else
    echo -e "${YELLOW}DVB-T blacklist already exists${NC}"
fi

# Create udev rules for RTL-SDR (allows non-root access)
if [ ! -f /etc/udev/rules.d/20-rtlsdr.rules ]; then
    echo "Creating udev rules for RTL-SDR..."
    cat > /etc/udev/rules.d/20-rtlsdr.rules <<EOF
# RTL-SDR
SUBSYSTEM=="usb", ATTRS{idVendor}=="0bda", ATTRS{idProduct}=="2832", MODE="0666"
SUBSYSTEM=="usb", ATTRS{idVendor}=="0bda", ATTRS{idProduct}=="2838", MODE="0666"
EOF
    udevadm control --reload-rules
    udevadm trigger
    echo -e "${GREEN}RTL-SDR udev rules created${NC}"
else
    echo -e "${YELLOW}RTL-SDR udev rules already exist${NC}"
fi

# Test RTL-SDR
echo "Testing RTL-SDR detection..."
if rtl_test -t 2>&1 | grep -q "Found"; then
    echo -e "${GREEN}RTL-SDR device detected!${NC}"
else
    echo -e "${YELLOW}WARNING: No RTL-SDR device detected (plug it in after setup)${NC}"
fi

################################################################################
# 5. Install SoapySDR
################################################################################

echo ""
echo -e "${BLUE}[5/10] Installing SoapySDR...${NC}"

apt-get install -y \
    soapysdr-tools \
    soapysdr-module-rtlsdr \
    soapysdr-module-hackrf \
    libsoapysdr-dev

# Verify SoapySDR installation
echo "Testing SoapySDR..."
if command -v SoapySDRUtil &> /dev/null; then
    echo -e "${GREEN}SoapySDR installed successfully${NC}"
    SoapySDRUtil --info
else
    echo -e "${RED}ERROR: SoapySDR installation failed${NC}"
    exit 1
fi

################################################################################
# 6. Install HackRF Tools (Optional)
################################################################################

echo ""
echo -e "${BLUE}[6/10] Installing HackRF tools...${NC}"

apt-get install -y \
    hackrf \
    libhackrf-dev

# Create udev rules for HackRF
if [ ! -f /etc/udev/rules.d/52-hackrf.rules ]; then
    echo "Creating udev rules for HackRF..."
    cat > /etc/udev/rules.d/52-hackrf.rules <<EOF
# HackRF One
ATTR{idVendor}=="1d50", ATTR{idProduct}=="6089", SYMLINK+="hackrf-one-%k", MODE="0666", GROUP="plugdev"
EOF
    udevadm control --reload-rules
    udevadm trigger
    echo -e "${GREEN}HackRF udev rules created${NC}"
else
    echo -e "${YELLOW}HackRF udev rules already exist${NC}"
fi

################################################################################
# 7. Install DUMP1090
################################################################################

echo ""
echo -e "${BLUE}[7/10] Installing DUMP1090...${NC}"

# Check which DUMP1090 variant to install
if apt-cache show dump1090-mutability &> /dev/null; then
    echo "Installing dump1090-mutability..."
    apt-get install -y dump1090-mutability
elif apt-cache show dump1090-fa &> /dev/null; then
    echo "Installing dump1090-fa..."
    apt-get install -y dump1090-fa
else
    echo -e "${YELLOW}WARNING: No dump1090 package found in repositories${NC}"
    echo "Installing dump1090 from source..."
    
    # Install dependencies
    apt-get install -y librtlsdr-dev pkg-config libusb-1.0-0-dev
    
    # Clone and build dump1090
    cd /tmp
    if [ ! -d "dump1090" ]; then
        git clone https://github.com/antirez/dump1090.git
    fi
    cd dump1090
    make
    
    # Install binary
    cp dump1090 /usr/local/bin/
    
    echo -e "${GREEN}dump1090 installed from source${NC}"
fi

# Configure DUMP1090
DUMP1090_CONFIG="/etc/default/dump1090-mutability"
if [ -f "$DUMP1090_CONFIG" ]; then
    echo "Configuring DUMP1090..."
    
    # Backup original config
    cp "$DUMP1090_CONFIG" "${DUMP1090_CONFIG}.backup"
    
    # Enable network output
    sed -i 's/^ENABLED=.*/ENABLED=yes/' "$DUMP1090_CONFIG"
    
    # Add network options if not present
    if ! grep -q "NET_OPTIONS" "$DUMP1090_CONFIG"; then
        echo 'NET_OPTIONS="--net --net-sbs-port 30003"' >> "$DUMP1090_CONFIG"
    fi
    
    echo -e "${GREEN}DUMP1090 configured${NC}"
fi

################################################################################
# 8. Install Kismet
################################################################################

echo ""
echo -e "${BLUE}[8/10] Installing Kismet...${NC}"

# Add Kismet repository for latest version
if [ ! -f /etc/apt/sources.list.d/kismet.list ]; then
    echo "Adding Kismet repository..."
    wget -O - https://www.kismetwireless.net/repos/kismet-release.gpg.key | apt-key add -
    echo "deb https://www.kismetwireless.net/repos/apt/release/$(lsb_release -cs) $(lsb_release -cs) main" \
        > /etc/apt/sources.list.d/kismet.list
    apt-get update
fi

apt-get install -y kismet

# Configure Kismet for Bluetooth monitoring
KISMET_CONF="$ACTUAL_HOME/.kismet/kismet.conf"
mkdir -p "$ACTUAL_HOME/.kismet"

if [ ! -f "$KISMET_CONF" ]; then
    echo "Creating Kismet configuration..."
    cat > "$KISMET_CONF" <<EOF
# Kismet configuration for On-the-Go Scanner
# Bluetooth data source
source=hci0:name=BluetoothAdapter

# Enable REST API
httpd_port=2501

# Minimal logging (to save disk space)
log_types=

# Enable Remote ID support (if available)
dot11_process_phy=true
EOF
    chown "$ACTUAL_USER:$ACTUAL_USER" "$KISMET_CONF"
    echo -e "${GREEN}Kismet configured${NC}"
else
    echo -e "${YELLOW}Kismet config already exists${NC}"
fi

# Add user to kismet group
usermod -aG kismet "$ACTUAL_USER"
echo -e "${GREEN}User $ACTUAL_USER added to kismet group${NC}"

################################################################################
# 9. Install gpsd (GPS Daemon)
################################################################################

echo ""
echo -e "${BLUE}[9/10] Installing gpsd...${NC}"

apt-get install -y \
    gpsd \
    gpsd-clients \
    python3-gps

# Configure gpsd
GPSD_CONFIG="/etc/default/gpsd"
if [ -f "$GPSD_CONFIG" ]; then
    echo "Configuring gpsd..."
    
    # Backup original
    cp "$GPSD_CONFIG" "${GPSD_CONFIG}.backup"
    
    # Configure for auto-detection
    cat > "$GPSD_CONFIG" <<EOF
# On-the-Go Scanner gpsd configuration
START_DAEMON="true"

# Device (update after plugging in GPS)
# Common devices: /dev/ttyUSB0, /dev/ttyACM0
DEVICES=""
# auto-detect GPS
for dev in /dev/ttyUSB* /dev/ttyACM*; do
  [ -e "$dev" ] || continue
  DEVICES="$dev"; break
done
[ -z "$DEVICES" ] && echo "[setup] No GPS device auto-detected; set DEVICES=/dev/ttyUSB0 if needed"

# Options
GPSD_OPTIONS="-n"

# Socket
GPSD_SOCKET="/var/run/gpsd.sock"
EOF
    
    echo -e "${GREEN}gpsd configured${NC}"
    echo -e "${YELLOW}NOTE: Update DEVICES in $GPSD_CONFIG after plugging in GPS${NC}"
fi

# Add user to dialout group (for serial port access)
usermod -aG dialout "$ACTUAL_USER"
echo -e "${GREEN}User $ACTUAL_USER added to dialout group${NC}"

################################################################################
# 10. Install Additional Dependencies
################################################################################

echo ""
echo -e "${BLUE}[10/10] Installing additional dependencies...${NC}"

# Bluetooth tools
apt-get install -y \
    bluez \
    bluetooth \
    libbluetooth-dev

# USB tools
apt-get install -y \
    usbutils \
    libusb-1.0-0-dev

# Add user to plugdev group (for USB device access)
usermod -aG plugdev "$ACTUAL_USER"

################################################################################
# Post-Installation
################################################################################

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Installation Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

echo -e "${YELLOW}IMPORTANT: Log out and log back in for group changes to take effect!${NC}"
echo ""

echo -e "${BLUE}Next Steps:${NC}"
echo "1. Log out and log back in (required for group permissions)"
echo "2. Navigate to the project directory"
echo "3. Run: npm install"
echo "4. Plug in your SDR and GPS devices"
echo "5. Start services:"
echo "   - DUMP1090: sudo systemctl start dump1090-mutability"
echo "   - Kismet:   kismet --daemonize --silent"
echo "   - gpsd:     sudo systemctl start gpsd"
echo "6. Run: npm start"
echo ""

echo -e "${BLUE}Verify Installation:${NC}"
echo "- Node.js:  node -v"
echo "- npm:      npm -v"
echo "- RTL-SDR:  rtl_test -t"
echo "- SoapySDR: SoapySDRUtil --find"
echo "- HackRF:   hackrf_info"
echo "- GPS:      gpspipe -w -n 5"
echo ""

echo -e "${BLUE}Service Status:${NC}"
echo "- DUMP1090: sudo systemctl status dump1090-mutability"
echo "- gpsd:     sudo systemctl status gpsd"
echo "- Kismet:   ps aux | grep kismet"
echo ""

echo -e "${YELLOW}Troubleshooting:${NC}"
echo "- If RTL-SDR not detected: sudo rmmod dvb_usb_rtl28xxu rtl2832"
echo "- If GPS not working: check /dev/ttyUSB* or /dev/ttyACM*"
echo "- If Kismet fails: check ~/.kismet/kismet.conf"
echo "- View logs: sudo journalctl -xe"
echo ""

echo -e "${GREEN}Setup script completed successfully!${NC}"

# Optional: Enable services on boot
read -p "Enable services to start on boot? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if systemctl list-unit-files | grep -q dump1090; then
        systemctl enable dump1090-mutability || systemctl enable dump1090-fa || true
        echo -e "${GREEN}DUMP1090 enabled on boot${NC}"
    fi
    
    systemctl enable gpsd
    echo -e "${GREEN}gpsd enabled on boot${NC}"
    
    echo -e "${YELLOW}NOTE: Kismet should be started manually or via systemd user service${NC}"
fi

echo ""
echo -e "${BLUE}For more information, see:${NC}"
echo "- README.md"
echo "- docs/USER_GUIDE.md"
echo "- docs/TROUBLESHOOTING.md"
echo ""

exit 0

# Ensure Kismet web binds to localhost and has auth
if [ -f /etc/kismet/kismet.conf ]; then
  sudo sed -i 's/^#\?httpd_host.*/httpd_host=127.0.0.1/' /etc/kismet/kismet.conf || true
  sudo sed -i 's/^#\?httpd_username.*/httpd_username=admin/' /etc/kismet/kismet.conf || true
  sudo sed -i 's/^#\?httpd_password.*/httpd_password=change_me/' /etc/kismet/kismet.conf || true
fi


# --- Enhancements: Dry Run, Backup, Verification ---

# Dry run mode: ./setup_v4.sh --dry-run
if [ "$1" = "--dry-run" ]; then
  DRY_RUN=true
  echo "[setup] DRY RUN MODE - No changes will be made"
fi

backup_configs() {
  if [ -f /etc/kismet/kismet.conf ]; then
    sudo cp /etc/kismet/kismet.conf /etc/kismet/kismet.conf.backup.$(date +%Y%m%d)
  fi
}

verify_installation() {
  echo "[setup] Running verification tests..."
  if rtl_test -t 2>&1 | grep -q "Found"; then
    echo "✅ RTL-SDR detected"
  else
    echo "⚠️  RTL-SDR not detected"
  fi

  if systemctl is-active --quiet dump1090-mutability; then
    echo "✅ DUMP1090 running"
  else
    echo "⚠️  DUMP1090 not running"
  fi

  if pgrep kismet >/dev/null; then
    echo "✅ Kismet running"
  else
    echo "⚠️  Kismet not running"
  fi

  if timeout 2 gpspipe -w -n 1 >/dev/null 2>&1; then
    echo "✅ GPS responding"
  else
    echo "⚠️  GPS not responding"
  fi
}
