#!/bin/bash

# Prudential Backend Management Script
# Usage: ./manage-backend.sh [start|stop|restart|status|logs|install-service]

BACKEND_DIR="/home/aditya.developer/prudential/backend"
VENV_PYTHON="/home/aditya.developer/prudential/venv/bin/python3"
APP_FILE="app_with_db.py"
LOG_FILE="$BACKEND_DIR/app.log"
SERVICE_FILE="prudential-backend.service"

case "$1" in
    start)
        echo "Starting backend..."
        cd "$BACKEND_DIR"
        
        # Kill any existing processes
        pkill -f "python.*app_with_db" 2>/dev/null
        sleep 2
        
        # Start in background
        nohup "$VENV_PYTHON" "$APP_FILE" > "$LOG_FILE" 2>&1 &
        
        sleep 3
        
        if pgrep -f "python.*app_with_db" > /dev/null; then
            echo "✅ Backend started successfully"
            echo "View logs: tail -f $LOG_FILE"
        else
            echo "❌ Failed to start backend"
            exit 1
        fi
        ;;
        
    stop)
        echo "Stopping backend..."
        pkill -f "python.*app_with_db" 2>/dev/null
        sleep 2
        
        if pgrep -f "python.*app_with_db" > /dev/null; then
            echo "⚠️  Some processes still running, forcing kill..."
            pkill -9 -f "python.*app_with_db" 2>/dev/null
            sleep 1
        fi
        
        echo "✅ Backend stopped"
        ;;
        
    restart)
        echo "Restarting backend..."
        $0 stop
        sleep 2
        $0 start
        ;;
        
    status)
        if pgrep -f "python.*app_with_db" > /dev/null; then
            echo "✅ Backend is RUNNING"
            echo ""
            ps aux | grep "python.*app_with_db" | grep -v grep
            echo ""
            echo "Test API: curl http://localhost:5001/api/user/check-system"
        else
            echo "❌ Backend is STOPPED"
            exit 1
        fi
        ;;
        
    logs)
        if [ -f "$LOG_FILE" ]; then
            tail -f "$LOG_FILE"
        else
            echo "❌ Log file not found: $LOG_FILE"
            exit 1
        fi
        ;;
        
    install-service)
        echo "Installing systemd service..."
        
        if [ ! -f "prudential-backend.service" ]; then
            echo "❌ Service file not found: prudential-backend.service"
            exit 1
        fi
        
        echo "This requires sudo access. You'll be prompted for your password."
        sudo cp prudential-backend.service /etc/systemd/system/
        sudo systemctl daemon-reload
        sudo systemctl enable prudential-backend.service
        sudo systemctl start prudential-backend.service
        
        echo ""
        echo "✅ Service installed!"
        echo ""
        echo "Service commands:"
        echo "  sudo systemctl status prudential-backend"
        echo "  sudo systemctl start prudential-backend"
        echo "  sudo systemctl stop prudential-backend"
        echo "  sudo systemctl restart prudential-backend"
        echo "  sudo journalctl -u prudential-backend -f"
        ;;
        
    *)
        echo "Prudential Backend Management"
        echo ""
        echo "Usage: $0 {start|stop|restart|status|logs|install-service}"
        echo ""
        echo "Commands:"
        echo "  start           - Start the backend"
        echo "  stop            - Stop the backend"
        echo "  restart         - Restart the backend"
        echo "  status          - Check if backend is running"
        echo "  logs            - View live logs (Ctrl+C to exit)"
        echo "  install-service - Install as systemd service (requires sudo)"
        exit 1
        ;;
esac
