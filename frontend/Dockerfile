FROM node:22-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY src ./src

# Create logs directory
RUN mkdir -p logs

# Expose port
EXPOSE 80

# Install serve to serve the built React app
RUN npm install -g serve

# Copy build files (will be created during deployment)
COPY build ./build

# Start the application
CMD ["serve", "-s", "build", "-l", "80"]
