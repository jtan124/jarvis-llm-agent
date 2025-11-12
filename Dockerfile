FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies with error output
RUN npm install --only=prod || (echo "npm install failed" && exit 1)

# Copy source code
COPY . .

# Validate directory structure
RUN ls -la src/ || (echo "src directory missing" && exit 1)

# Set port
ENV PORT=8080
EXPOSE 8080

# Health check (optional but helpful)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start application
CMD ["node", "src/index.js"]


