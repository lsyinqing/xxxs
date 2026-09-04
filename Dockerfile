FROM node:22-alpine

WORKDIR /app

# Install dependencies first (caching)
COPY package.json package-lock.json* ./
RUN npm install

# Copy the rest of the application
COPY . .

# Build both frontend and backend
RUN npm run build

# Expose port (Cloud providers will inject PORT env var, but good to default)
EXPOSE 3000

# Start the built server
ENV NODE_ENV=production
CMD ["node", "dist/server.cjs"]
