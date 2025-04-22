web: npm ci --prefix frontend && npm run build --prefix frontend && npm start --prefix frontend
worker: npm ci --prefix functions && npm rebuild sqlite3 --update-binary --prefix functions && node functions/index.js
