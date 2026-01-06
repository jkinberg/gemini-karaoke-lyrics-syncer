FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Build frontend and server
RUN npm run build

# Expose port (Cloud Run uses PORT env var, defaults to 8080)
EXPOSE 8080

# Run the server
CMD ["npm", "run", "start"]
