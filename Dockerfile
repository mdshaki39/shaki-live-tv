FROM node:18-alpine

WORKDIR /app

# Install dependencies first (better Docker layer caching)
COPY package.json package-lock.json ./
RUN npm install --omit=dev

# Copy the rest of the app
COPY . .

# Back4app Containers (and most CaaS platforms) inject PORT at runtime
EXPOSE 3000

CMD ["node", "server.js"]
