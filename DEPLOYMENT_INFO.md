# Prudential MDRT Certificate Generator - Deployment Information

## Deployment Summary
The Prudential MDRT Certificate Generator has been successfully deployed alongside the Nurse Rostering project.

## Service Ports and Access

### Nurse Rostering (Existing)
- Frontend Port: 4173
- Access: http://YOUR_VM_IP:80

### Prudential (New)
- Backend: Port 5001
- Frontend: Port 3001
- Access: http://YOUR_VM_IP:8080

## Start Services

Backend:
cd /home/aditya.developer/prudential/backend
nohup ../venv/bin/python app.py > backend.log 2>&1 &

Frontend:
cd /home/aditya.developer/prudential/frontend
PORT=3001 nohup npm start > frontend.log 2>&1 &

## Check Status
ss -tlnp | grep -E ":(80|4173|5001|3001|8080)"

## Nginx Configuration
- Nurse Rostering: Port 80 -> 4173
- Prudential: Port 8080 -> 3001 (frontend) and 5001 (backend)
