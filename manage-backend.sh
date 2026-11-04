#!/bin/bash
set -euo pipefail
TASK_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
case "${1:-}" in
    start|stop|restart|status) sudo systemctl "$1" prudential-backend.service ;;
    logs) sudo journalctl -u prudential-backend.service -f ;;
    install-service)
        sudo install -m 644 "$TASK_ROOT/prudential-backend.service" /etc/systemd/system/prudential-backend.service
        sudo systemctl daemon-reload
        sudo systemctl enable prudential-backend.service
        ;;
    *) echo "Usage: $0 {start|stop|restart|status|logs|install-service}"; exit 1 ;;
esac
