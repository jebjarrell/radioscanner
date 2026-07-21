# Building OnTheGo Scanner for Windows

Developer guide for building Windows binaries of OnTheGo Scanner.

---

## Prerequisites

### Required Software

#### Node.js & npm
- **Node.js:** 18.17.0 or newer
- **npm:** 9.0.0 or newer

**Download:** https://nodejs.org/

**Verify installation:**
```powershell
node --version  # Should be v18.17.0+
npm --version   # Should be 9.0.0+
```

#### Git for Windows
**Download:** https://git-scm.com/download/win

**Verify installation:**
```powershell
git --version
```

#### Build Tools (for native modules)

**Option A: windows-build-tools (Automated)**
```powershell
# Run PowerShell as Administrator
npm install --global --production windows-build-tools
```

This installs:
- Visual Studio Build Tools
- Python 3.x
- Windows SDK

**Option B: Manual Installation**
- Visual Studio 2019 or newer (Community Edition)
  - Workload: "Desktop development with C++"
- Python 3.x
- Windows 10 SDK

---

## Build Environment Setup

### 1. Clone Repository

```powershell
git clone https://github.com/yourusername/radioscanner.git
cd radioscanner
```

### 2. Checkout Branch

```powershell
# For Windows development
git checkout claude/explore-radio-scanner-011CUydwDCLHgTYFBnnw2Tze

# Or stay on main
git checkout main
```

### 3. Install Dependencies

```powershell
npm install
```

**Note:** This may take 5-15 minutes as native modules compile.

### 4. Rebuild Native Modules for Electron

```powershell
npm run rebuild:electron
```

This rebuilds:
- better-sqlite3 (database)
- @abandonware/noble (Bluetooth, may fail if no Bluetooth)

---

## Building for Windows

### Quick Build

```powershell
# Build for Windows (x64 + ARM64)
npm run build:win
```

### Build Process Steps

The build command performs:
1. **Lint** - ESLint code quality checks
2. **Type Check** - TypeScript type checking
3. **Vite Build** - Frontend compilation
4. **electron-builder** - Package for Windows
5. **Copy Artifacts** - Copy installers to dist/

### Build Outputs

After successful build:

```
dist/
├── installers/
│   ├── onthego-scanner-0.1.0-x64-setup.exe    (NSIS installer, ~80-120MB)
│   ├── onthego-scanner-0.1.0-x64.exe           (Portable, ~80-120MB)
│   └── onthego-scanner-0.1.0-arm64-setup.exe   (ARM64 NSIS, ~80-120MB)
└── onthego-scanner-0.1.0-x64-setup.exe         (Copied by script)
```

**File Types:**
- **NSIS Setup:** Full installer with uninstaller
- **Portable:** Single .exe, no installation needed
- **ARM64:** For Windows on ARM devices

---

## Build on Linux (Cross-Compilation)

You can build Windows binaries from Linux using electron-builder.

### Prerequisites on Linux

```bash
# Install Wine (for NSIS packaging)
sudo apt-get install wine64 wine32

# Or on Fedora
sudo dnf install wine
```

### Build from Linux

```bash
# Clone and setup
git clone https://github.com/yourusername/radioscanner.git
cd radioscanner
npm install

# Build for Windows
npm run build:win

# Build for all platforms
npm run build:all
```

**Note:** Cross-compilation from Linux is faster and produces identical binaries.

---

## Development Workflow

### 1. Run Development Server

```powershell
# Terminal 1: Start Vite dev server
npm run dev
```

This starts:
- Vite dev server on port 5173
- Hot reload for frontend changes
- Electron in development mode

### 2. Run Backend Separately (Optional)

```powershell
# Terminal 2: Start backend server
npm run backend
```

**Environment Variables:**
```powershell
# Run with mock data
$env:USE_MOCK_DATA="true"
npm run dev

# Custom port
$env:BACKEND_PORT="3001"
npm run dev
```

### 3. Run Tests

```powershell
# Run unit tests
npm run test

# Run type checking
npm run typecheck

# Run linter
npm run lint

# Fix linting issues
npm run lint -- --fix
```

---

## Troubleshooting Build Issues

### Native Module Compilation Fails

**Error:** `gyp ERR! stack Error: Could not find any Visual Studio installation`

**Solution:**
1. Install Visual Studio Build Tools:
   ```powershell
   npm install --global windows-build-tools
   ```
2. Or install Visual Studio 2019+ with C++ workload
3. Restart terminal
4. Try again:
   ```powershell
   npm run rebuild:electron
   ```

### better-sqlite3 Build Fails

**Error:** `Error: Cannot find module 'better-sqlite3'`

**Solution:**
```powershell
# Clean and rebuild
rm -r node_modules
npm install
npm run rebuild:electron
```

### Electron Builder Fails

**Error:** `Cannot create directory: Permission denied`

**Solution:**
```powershell
# Run PowerShell as Administrator
# Or change output directory permissions
# Or build to different location
$env:ELECTRON_BUILDER_ALLOW_UNRESOLVED_DEPENDENCIES="true"
npm run build:win
```

### "Out of Memory" During Build

**Error:** `FATAL ERROR: Reached heap limit`

**Solution:**
```powershell
# Increase Node.js memory limit
$env:NODE_OPTIONS="--max-old-space-size=4096"
npm run build:win
```

### NSIS Packaging Fails (Linux)

**Error:** `wine: could not load kernel32.dll`

**Solution:**
Install Wine properly:
```bash
# Ubuntu/Debian
sudo dpkg --add-architecture i386
sudo apt-get update
sudo apt-get install wine64 wine32

# Test Wine
wine --version
```

### Certificate Errors

**Warning:** Windows SmartScreen warning when running unsigned .exe

**Expected Behavior:** This is normal for unsigned applications.

**Solutions:**
1. For testing: Click "More info" → "Run anyway"
2. For distribution: Sign with code signing certificate
3. For development: Ignore warning

---

## Code Signing (Optional)

For production releases, sign the executable to avoid SmartScreen warnings.

### Get Code Signing Certificate

**Providers:**
- DigiCert
- Sectigo
- GlobalSign

**Cost:** ~$300-500/year

### Configure Signing

Update `package.json`:
```json
{
  "build": {
    "win": {
      "certificateFile": "path/to/certificate.pfx",
      "certificatePassword": "your-password",
      "signingHashAlgorithms": ["sha256"],
      "sign": "./scripts/sign-windows.js"
    }
  }
}
```

**⚠️ Security:** Never commit certificates or passwords to git!

---

## Platform-Specific Notes

### Windows-Specific Code

Code that detects Windows platform:

```typescript
// Check platform
if (process.platform === 'win32') {
  // Windows-specific code
}

// Signal handling
const killSignal = process.platform === 'win32' ? 'SIGKILL' : 'SIGTERM';
child.kill(killSignal);
```

**Files with platform-specific logic:**
- `src/main/index.ts` - Signal handling
- `src/backend/storage/db.ts` - Path resolution
- `src/backend/clients/bluetoothRidClient.ts` - Bluetooth warnings

### Database Paths on Windows

```typescript
// Relative paths work correctly
const dbPath = path.join('.', 'data', 'settings.sqlite');

// Resolves to:
// Development: <project-root>/data/settings.sqlite
// Packaged: <app-path>/data/settings.sqlite
```

**User data location:**
- `%LOCALAPPDATA%\OnTheGo Scanner\`
- Example: `C:\Users\YourName\AppData\Local\OnTheGo Scanner\`

---

## Build Scripts Reference

### Available Scripts

```powershell
# Development
npm run dev                # Start dev server
npm run backend            # Start backend only

# Building
npm run build              # Build for current platform (Linux)
npm run build:win          # Build for Windows
npm run build:linux        # Build for Linux
npm run build:all          # Build for Windows and Linux

# Testing
npm run test               # Run unit tests
npm run typecheck          # TypeScript type checking
npm run lint               # Run ESLint

# Utilities
npm run rebuild:electron   # Rebuild native modules for Electron
npm run doctor             # Check service connectivity
npm run mock               # Run with mock data
```

### Build Configuration

Located in `package.json`:

```json
{
  "build": {
    "win": {
      "target": ["nsis", "portable"],
      "icon": "public/icon.png",
      "artifactName": "onthego-scanner-${version}-${arch}-setup.${ext}"
    }
  }
}
```

---

## CI/CD with GitHub Actions

### Example Workflow

Create `.github/workflows/build-windows.yml`:

```yaml
name: Build Windows

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: windows-latest

    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'

    - name: Install dependencies
      run: npm install

    - name: Run tests
      run: npm test

    - name: Build for Windows
      run: npm run build:win

    - name: Upload artifacts
      uses: actions/upload-artifact@v3
      with:
        name: windows-build
        path: dist/installers/*.exe
```

---

## Release Process

### 1. Update Version

```powershell
# Update version in package.json
npm version patch  # or minor, or major

# Commit
git add package.json package-lock.json
git commit -m "chore: bump version to X.X.X"
git push
```

### 2. Build Release

```powershell
# Clean build
rm -r dist dist-electron node_modules
npm install
npm run build:win
```

### 3. Test Build

```powershell
# Test the installer
.\dist\onthego-scanner-X.X.X-x64-setup.exe

# Or test portable
.\dist\onthego-scanner-X.X.X-x64.exe
```

### 4. Create GitHub Release

```powershell
# Tag release
git tag -a v0.1.0 -m "Release v0.1.0"
git push origin v0.1.0

# Upload artifacts to GitHub Releases
# - Go to GitHub repository
# - Releases → Create new release
# - Upload .exe files from dist/
# - Add release notes
```

---

## Performance Optimization

### Reduce Build Size

```powershell
# Analyze bundle size
$env:WEBPACK_ANALYZE="true"
npm run build:win
```

### Build Time Optimization

```powershell
# Parallel builds (multi-core)
npm run build:all

# Skip linting for faster builds (development only)
vite build && electron-builder --win
```

---

## Common Development Tasks

### Add Windows-Specific Feature

```typescript
// src/some-file.ts

if (process.platform === 'win32') {
  // Windows-only feature
  console.log('Running on Windows');
}
```

### Update Dependencies

```powershell
# Check for outdated packages
npm outdated

# Update specific package
npm update electron

# Update all packages
npm update

# Rebuild native modules after updates
npm run rebuild:electron
```

### Debug Build Issues

```powershell
# Enable verbose logging
$env:DEBUG="electron-builder"
npm run build:win

# Check electron-builder cache
ls $env:LOCALAPPDATA\electron-builder\Cache

# Clear cache if needed
rm -r $env:LOCALAPPDATA\electron-builder\Cache
```

---

## Additional Resources

- **Electron Builder Docs:** https://www.electron.build/
- **Node.js Windows Guide:** https://nodejs.org/en/docs/guides/
- **Windows Build Tools:** https://github.com/felixrieseberg/windows-build-tools
- **Code Signing Guide:** https://www.electron.build/code-signing

---

## Getting Help

### Build Issues

1. Check this guide first
2. Search GitHub issues: https://github.com/yourusername/radioscanner/issues
3. Check electron-builder issues
4. Ask in Discussions

### Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for:
- Code style guidelines
- Pull request process
- Testing requirements
- Documentation standards

---

## Next Steps

- [Windows Setup Guide](WINDOWS_SETUP.md) - End user installation
- [User Guide](USER_GUIDE.md) - Application usage
- [Development Guide](DEVELOPMENT.md) - General development
