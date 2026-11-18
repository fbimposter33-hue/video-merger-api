const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
    res.send('FFmpeg Merger API is running!');
});

app.get('/merge', async (req, res) => {
    const videoUrl = req.query.video;
    const audioUrl = req.query.audio;

    if (!videoUrl || !audioUrl) {
        return res.status(400).json({ error: 'Please provide ?video= and ?audio= URLs' });
    }

    const outputFileName = `output_${Date.now()}.mp4`;
    const outputPath = path.join('/tmp', outputFileName);

    console.log('Merging streams with custom headers...');

    // স্ন্যাপাইট সার্ভারের জন্য প্রয়োজনীয় হেডার্স
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://www.snapyt.app/',
        'Origin': 'https://www.snapyt.app'
    };

    ffmpeg()
        .input(videoUrl)
        .inputOptions([
            '-headers', Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\r\n')
        ])
        .input(audioUrl)
        .inputOptions([
            '-headers', Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\r\n')
        ])
        .outputOptions([
            '-c:v copy',
            '-c:a aac',
            '-strict experimental'
        ])
        .save(outputPath)
        .on('end', () => {
            console.log('Merge finished successfully!');
            
            res.download(outputPath, 'downloaded_video.mp4', (err) => {
                if (err) console.error('Download error:', err);
                
                fs.unlink(outputPath, (unlinkErr) => {
                    if (unlinkErr) console.error('Failed to delete temp file:', unlinkErr);
                });
            });
        })
        .on('error', (err) => {
            console.error('FFmpeg error:', err.message);
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            res.status(500).json({ error: 'Failed to merge video and audio: ' + err.message });
        });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
