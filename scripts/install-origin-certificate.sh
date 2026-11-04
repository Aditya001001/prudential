#!/bin/bash
# Usage: sudo bash scripts/install-origin-certificate.sh signed.pem cloudflare-origin-ca.pem
set -euo pipefail
if [[ $EUID -ne 0 || $# -ne 2 ]]; then
    echo 'Usage: sudo bash scripts/install-origin-certificate.sh signed.pem cloudflare-origin-ca.pem' >&2
    exit 1
fi
TASK_CERTIFICATE="$1"
TASK_CA="$2"
TASK_KEY=/etc/ssl/private/prudential-rotation/replacement.key
TASK_CURRENT_CERT=/etc/ssl/certs/prudential-cert.pem
TASK_CURRENT_KEY=/etc/ssl/private/prudential-key.pem
TASK_TEMP="$(mktemp -d)"
trap 'rm -rf "$TASK_TEMP"' EXIT
openssl verify -CAfile "$TASK_CA" -verify_hostname prudential-uat.innocorn.net "$TASK_CERTIFICATE"
openssl x509 -in "$TASK_CERTIFICATE" -checkend 2592000 -noout
openssl x509 -in "$TASK_CERTIFICATE" -pubkey -noout | openssl pkey -pubin -outform DER > "$TASK_TEMP/certificate.pub"
openssl pkey -in "$TASK_KEY" -pubout -outform DER > "$TASK_TEMP/key.pub"
cmp "$TASK_TEMP/certificate.pub" "$TASK_TEMP/key.pub"
TASK_BACKUP="/etc/ssl/private/prudential-rotation/previous-$(date +%Y%m%d_%H%M%S)"
install -d -m 700 "$TASK_BACKUP"
cp -p "$TASK_CURRENT_CERT" "$TASK_BACKUP/certificate.pem"
cp -p "$TASK_CURRENT_KEY" "$TASK_BACKUP/private.key"
rollback() {
    cp -p "$TASK_BACKUP/certificate.pem" "$TASK_CURRENT_CERT"
    cp -p "$TASK_BACKUP/private.key" "$TASK_CURRENT_KEY"
    nginx -t && systemctl reload nginx
    echo 'Certificate installation failed; previous origin credentials restored.' >&2
}
trap rollback ERR
install -m 644 "$TASK_CERTIFICATE" "$TASK_CURRENT_CERT.next"
install -m 600 "$TASK_KEY" "$TASK_CURRENT_KEY.next"
mv "$TASK_CURRENT_CERT.next" "$TASK_CURRENT_CERT"
mv "$TASK_CURRENT_KEY.next" "$TASK_CURRENT_KEY"
nginx -t
systemctl reload nginx
trap - ERR
echo 'Replacement installed. Verify the public site, then revoke the old origin certificate in Cloudflare.'
