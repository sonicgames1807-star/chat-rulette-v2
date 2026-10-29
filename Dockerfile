FROM node:24-alpine
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build && npm prune --omit=dev
ENV PORT=4173
EXPOSE 4173
CMD ["npm", "start"]
