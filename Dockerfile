FROM node:18-slim

# লিনাক্স সিস্টেমে FFmpeg ইন্সটল করা
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
