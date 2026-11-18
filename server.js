const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
    res.send('FFmpeg Local Merger API is running!');
});

// হেল্পার ফাংশন: সঠিক কুকি এবং হেডার সহ ফাইল ডাউনলোড করার জন্য
async function downloadFile(url, outputPath) {
    const res = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Referer': 'https://www.snapyt.app/',
            'Origin': 'https://www.snapyt.app',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'same-origin',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1'
        }
    });

    if (!res.ok) throw new Error(`Failed to fetch ${url} - Status: ${res.status}`);
    
    const fileStream = fs.createWriteStream(outputPath);
    const bodyStream = res.body;

    if (bodyStream.pipe) {
        bodyStream.pipe(fileStream);
        await new Promise((resolve, reject) => {
            bodyStream.on('error', reject);
            fileStream.on('finish', resolve);
        });
    } else {
        const reader = bodyStream.getReader();
        await new Promise(async (resolve, reject) => {
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    fileStream.write(value);
                }
                fileStream.end();
                resolve();
            } catch (err) {
                reject(err);
            }
        });
    }
}

app.get('/merge', async (req, res) => {
    const videoUrl = req.query.video;
    const audioUrl = req.query.audio;

    if (!videoUrl || !audioUrl) {
        return res.status(400).json({ error: 'Please provide ?video= and ?audio= URLs' });
    }

    const timestamp = Date.now();
    const videoPath = path.join('/tmp', `video_${timestamp}.mp4`);
    const audioPath = path.join('/tmp', `audio_${timestamp}.mp4`);
    const outputPath = path.join('/tmp', `output_${timestamp}.mp4`);

    try {
        console.log('Downloading video and audio streams locally with full headers...');
        
        await Promise.all([
            downloadFile(videoUrl, videoPath),
            downloadFile(audioUrl, audioPath)
        ]);

        console.log('Merging local files with FFmpeg...');

        await new Promise((resolve, reject) => {
            ffmpeg()
                .input(videoPath)
                .input(audioPath)
                .outputOptions([
                    '-c:v copy',
                    '-c:a aac',
                    '-strict experimental'
                ])
                .save(outputPath)
                .on('end', resolve)
                .on('error', reject);
        });

        console.log('Merge finished successfully!');

        res.download(outputPath, 'merged_video.mp4', (err) => {
            if (err) console.error('Download error:', err);
            
            [videoPath, audioPath, outputPath].forEach(file => {
                if (fs.existsSync(file)) fs.unlinkSync(file);
            });
        });

    } catch (err) {
        console.error('Process error:', err.message);
        
        [videoPath, audioPath, outputPath].forEach(file => {
            if (fs.existsSync(file)) fs.unlinkSync(file);
        });

        res.status(500).json({ error: 'Failed to process video: ' + err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
