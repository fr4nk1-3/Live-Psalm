#!/bin/sh
set -e

# Ensure /usr/bin/live-psalms and the .desktop launcher pass --no-sandbox on Linux
# (prevents Chromium zygote/chrome-sandbox execvp failure with "/opt/Live Psalms"
# space-in-path and Ubuntu 24.04+ AppArmor user namespace restrictions).
if [ -L /usr/bin/live-psalms ] || [ -f /usr/bin/live-psalms ]; then
  rm -f /usr/bin/live-psalms
fi

cat <<'EOF' > /usr/bin/live-psalms
#!/bin/sh
exec "/opt/Live Psalms/live-psalms" --no-sandbox "$@"
EOF
chmod 0755 /usr/bin/live-psalms

if [ -f /usr/share/applications/live-psalms.desktop ]; then
  sed -i 's|^Exec=.*|Exec="/opt/Live Psalms/live-psalms" --no-sandbox %U|' /usr/share/applications/live-psalms.desktop
fi

if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache -f -t /usr/share/icons/hicolor >/dev/null 2>&1 || true
fi

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database /usr/share/applications >/dev/null 2>&1 || true
fi
