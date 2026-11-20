# backend/Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package.json (và package-lock.json nếu có)
COPY package*.json ./

# Cài đặt dependencies an toàn (không lỗi nếu thiếu package-lock.json)
RUN npm install --omit=dev

# Copy toàn bộ mã nguồn backend
COPY . .

ENV NODE_ENV=production
ENV PORT=5000
EXPOSE 5000

CMD ["node", "server.js"]