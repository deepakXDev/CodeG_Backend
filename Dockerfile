# Base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install dependencies for native modules
RUN apk update && apk add --no-cache g++ gcc make python3 nodejs

# Copy everything except ignored files
COPY . .

# Install npm dependencies
RUN npm install

# Expose the port your app runs on
EXPOSE 4000

# Start the server
CMD ["npm", "run", "dev"]