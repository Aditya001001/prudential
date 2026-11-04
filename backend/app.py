"""Compatibility entry point. The supported API lives in app_with_db.py."""
from app_with_db import app

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5001, debug=False)
