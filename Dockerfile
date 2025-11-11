FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --only=prod
COPY . .
ENV PORT=8080
EXPOSE 8080
CMD ["node", "index.js"]
