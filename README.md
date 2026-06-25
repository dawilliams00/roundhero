# RoundHero

D&D 5e Combat Tracker — track your turn, abilities, spells, and more.

## Stack
- Backend: Python / Flask / SQLite
- Frontend: React

## Local Development

### Backend
```
cd backend
pip install -r requirements.txt
python app.py
```

### Frontend
```
cd frontend
npm install
npm start
```

## Deploy to Render
1. Push to GitHub
2. Connect repo to Render
3. Backend: Web Service — Python, `pip install -r requirements.txt`, `gunicorn "app:create_app()"`)
4. Frontend: Static Site — `npm run build`, publish `build/`
5. Set REACT_APP_API_URL env var on frontend to your backend URL

## roundhero.app
